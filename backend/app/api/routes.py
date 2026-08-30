import uuid
from uuid import UUID
from datetime import date, datetime, timezone

import io
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from decimal import Decimal

from app.db.session import get_db
from app.models import (
    Tenant,
    User,
    Customer,
    Property,
    MunicipalAccount,
    CollectionCase,
    Promise,
    PaymentPlan,
    Payment,
    AuditEvent,
)
from app.schemas import (
    UserLogin,
    UserCreate,
    UserResponse,
    TokenResponse,
    CustomerCreate,
    CustomerResponse,
    PropertyResponse,
    MunicipalAccountCreate,
    MunicipalAccountResponse,
    MunicipalAccountDetailResponse,
    CollectionCaseCreate,
    CollectionCaseResponse,
    CaseStatusUpdate,
    AuditEventResponse,
    PromiseCreate,
    PromiseStatusUpdate,
    PromiseResponse,
    PaymentPlanCreate,
    PaymentPlanStatusUpdate,
    PaymentPlanResponse,
    PaymentCreate,
    PaymentReconciliation,
    PaymentResponse,
    PaymentReconciliationUpdate,
    WorkQueueItem,
    CaseAssignmentUpdate,
    ContactAttemptCreate,
    ContactAttemptResponse,
    ContactHistoryItem,
    CaseGenerationRequest,
    CaseGenerationResult,
)
from app.services.auth import (
    hash_password,
    verify_password,
    seed_default_users,
)
from app.services.work_queue import (
    calculate_priority_score,
    determine_next_action,
)
from app.services.contact_actions import (
    validate_contact_channel,
    validate_contact_outcome,
    determine_case_status,
)
from app.services.payment_plans import (
    validate_frequency,
    validate_promise_status,
    validate_plan_status,
)
from app.services.payments import (
    apply_payment_to_account,
)
from app.services.imports import (
    import_accounts,
    build_column_mapping,
    validate_columns,
)
from app.services.case_engine import (
    generate_cases_for_tenant,
    generate_or_update_case_for_account,
)


router = APIRouter()


# ---------------------------------------------------------
# Authentication & User Management
# ---------------------------------------------------------

@router.post("/auth/seed")
def seed_users_endpoint(db: Session = Depends(get_db)):
    seed_default_users(db)
    return {"status": "success", "message": "Default SuperAdmin and Admin accounts initialized."}


@router.post("/auth/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    # Ensure default users are seeded on first login attempt if DB is fresh
    seed_default_users(db)

    user = db.execute(
        select(User).where(User.email == payload.email)
    ).scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="User account is deactivated",
        )

    # In a full JWT implementation, encode payload; here we generate a valid session token
    token = f"cos_{user.role.lower()}_{uuid.uuid4().hex}"

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


@router.post("/auth/users", response_model=UserResponse)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.execute(
        select(User).where(User.email == payload.email)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="A user with this email already exists.",
        )

    new_user = User(
        id=uuid.uuid4(),
        tenant_id=payload.tenant_id,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role.upper(),
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.get("/auth/users", response_model=list[UserResponse])
def list_users(
    tenant_id: UUID | None = None,
    db: Session = Depends(get_db),
):
    query = select(User).order_by(User.created_at.desc())
    if tenant_id:
        query = query.where(User.tenant_id == tenant_id)
    return db.execute(query).scalars().all()


# ---------------------------------------------------------
# Dashboard
# ---------------------------------------------------------

@router.get("/dashboard/summary")
def dashboard_summary(
    tenant_id: UUID | None = None,
    db: Session = Depends(get_db),
):
    # ---------------------------------------------------------
    # Municipal account metrics
    # ---------------------------------------------------------

    account_query = db.query(
        func.coalesce(func.sum(MunicipalAccount.balance), 0),
        func.coalesce(func.sum(MunicipalAccount.arrears), 0),
        func.count(MunicipalAccount.id),
    )
    if tenant_id:
        account_query = account_query.filter(
            MunicipalAccount.tenant_id == tenant_id
        )

    debt_book, total_arrears, total_accounts = (
        account_query.first() or (0, 0, 0)
    )

    # ---------------------------------------------------------
    # Payment metrics
    # ---------------------------------------------------------

    payment_query = db.query(
        func.coalesce(func.sum(Payment.amount), 0)
    ).filter(
        Payment.reconciliation_status.in_(
            [
                "RECONCILED",
                "POSTED",
                "ALLOCATED",
                "SUCCESS",
            ]
        )
    )
    if tenant_id:
        payment_query = payment_query.filter(
            Payment.tenant_id == tenant_id
        )

    recovered = payment_query.scalar() or 0

    # ---------------------------------------------------------
    # Outstanding debt
    # ---------------------------------------------------------

    outstanding = Decimal(str(debt_book)) - Decimal(str(recovered))

    if outstanding < 0:
        outstanding = Decimal("0")

    # ---------------------------------------------------------
    # Recovery rate
    # ---------------------------------------------------------

    if Decimal(str(debt_book)) > 0:
        recovery_rate = (
            Decimal(str(recovered))
            / Decimal(str(debt_book))
        ) * Decimal("100")
    else:
        recovery_rate = Decimal("0")

    # ---------------------------------------------------------
    # Collection case metrics
    # ---------------------------------------------------------

    case_query = db.query(
        func.count(CollectionCase.id)
    ).filter(
        CollectionCase.status.notin_(
            [
                "PAID",
                "CLOSED",
            ]
        )
    )
    if tenant_id:
        case_query = case_query.filter(
            CollectionCase.tenant_id == tenant_id
        )

    active_cases = case_query.scalar() or 0

    # ---------------------------------------------------------
    # Broken promises
    # ---------------------------------------------------------

    promise_query = db.query(
        func.count(Promise.id)
    ).filter(
        Promise.status == "BROKEN"
    )
    if tenant_id:
        promise_query = promise_query.join(
            CollectionCase,
            CollectionCase.id == Promise.case_id,
        ).filter(
            CollectionCase.tenant_id == tenant_id
        )

    broken_promises = promise_query.scalar() or 0

    # ---------------------------------------------------------
    # Return dashboard summary
    # ---------------------------------------------------------

    return {
        "debt_book": float(debt_book),
        "total_arrears": float(total_arrears),
        "recovered": float(recovered),
        "outstanding": float(outstanding),
        "recovery_rate": round(float(recovery_rate), 2),
        "total_accounts": total_accounts,
        "active_cases": active_cases,
        "broken_promises": broken_promises,
    }


# ---------------------------------------------------------
# Workflow
# ---------------------------------------------------------

@router.get("/workflow/states")
def workflow_states():
    return [
        "NEW",
        "VALIDATED",
        "CONTACT_ATTEMPTED",
        "ENGAGED",
        "PROMISE_TO_PAY",
        "PAYMENT_ARRANGEMENT",
        "PAYING",
        "BROKEN_PROMISE",
        "ESCALATED",
        "DISPUTED",
        "PAID",
        "CLOSED",
    ]


# ---------------------------------------------------------
# Customers
# ---------------------------------------------------------

@router.post(
    "/customers",
    response_model=CustomerResponse,
)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
):
    customer = Customer(
        id=uuid.uuid4(),
        tenant_id=payload.tenant_id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        id_number=payload.id_number,
        company_registration=payload.company_registration,
        mobile=payload.mobile,
        email=payload.email,
        created_at=datetime.now(timezone.utc),
    )

    db.add(customer)
    db.commit()
    db.refresh(customer)

    return customer


@router.get(
    "/customers",
    response_model=list[CustomerResponse],
)
def list_customers(
    tenant_id: UUID,
    db: Session = Depends(get_db),
):
    return db.execute(
        select(Customer)
        .where(Customer.tenant_id == tenant_id)
        .order_by(Customer.created_at.desc())
    ).scalars().all()


@router.get(
    "/customers/{customer_id}",
    response_model=CustomerResponse,
)
def get_customer(
    customer_id: UUID,
    tenant_id: UUID,
    db: Session = Depends(get_db),
):
    customer = db.execute(
        select(Customer)
        .where(
            Customer.id == customer_id,
            Customer.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not customer:
        raise HTTPException(
            status_code=404,
            detail="Customer not found",
        )

    return customer


# ---------------------------------------------------------
# Municipal Accounts
# ---------------------------------------------------------

@router.post(
    "/accounts",
    response_model=MunicipalAccountResponse,
)
def create_account(
    payload: MunicipalAccountCreate,
    db: Session = Depends(get_db),
):
    account = MunicipalAccount(
        id=uuid.uuid4(),
        tenant_id=payload.tenant_id,
        customer_id=payload.customer_id,
        property_id=payload.property_id,
        account_number=payload.account_number,
        account_status=payload.account_status,
        balance=payload.balance,
        arrears=payload.arrears,
        days_in_arrears=payload.days_in_arrears,
        last_payment_date=payload.last_payment_date,
        last_payment_amount=payload.last_payment_amount,
    )

    db.add(account)
    db.commit()
    db.refresh(account)

    return account


@router.get(
    "/accounts",
    response_model=list[MunicipalAccountResponse],
)
def list_accounts(
    tenant_id: UUID,
    db: Session = Depends(get_db),
):
    return db.execute(
        select(MunicipalAccount)
        .where(
            MunicipalAccount.tenant_id == tenant_id
        )
        .order_by(
            MunicipalAccount.arrears.desc()
        )
    ).scalars().all()


@router.get(
    "/accounts/{account_id}",
    response_model=MunicipalAccountResponse,
)
def get_account(
    account_id: UUID,
    tenant_id: UUID,
    db: Session = Depends(get_db),
):
    account = db.execute(
        select(MunicipalAccount)
        .where(
            MunicipalAccount.id == account_id,
            MunicipalAccount.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=404,
            detail="Municipal account not found",
        )

    return account


@router.get(
    "/accounts/{account_id}/360",
    response_model=MunicipalAccountDetailResponse,
)
def get_account_360(
    account_id: UUID,
    tenant_id: UUID,
    db: Session = Depends(get_db),
):
    account = db.execute(
        select(MunicipalAccount)
        .where(
            MunicipalAccount.id == account_id,
            MunicipalAccount.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=404,
            detail="Municipal account not found",
        )

    customer = None
    if account.customer_id:
        customer = db.execute(
            select(Customer)
            .where(Customer.id == account.customer_id)
        ).scalar_one_or_none()

    prop = None
    if account.property_id:
        prop = db.execute(
            select(Property)
            .where(Property.id == account.property_id)
        ).scalar_one_or_none()

    cases = db.execute(
        select(CollectionCase)
        .where(
            CollectionCase.account_id == account_id,
            CollectionCase.tenant_id == tenant_id,
        )
        .order_by(CollectionCase.opened_at.desc())
    ).scalars().all()

    active_case = None
    case_ids = [c.id for c in cases]
    for c in cases:
        if c.status not in ["PAID", "CLOSED"]:
            active_case = {
                "id": str(c.id),
                "status": c.status,
                "priority": c.priority,
                "strategy_code": c.strategy_code,
                "assigned_to": c.assigned_to,
                "opened_at": c.opened_at.isoformat() if c.opened_at else None,
            }
            break

    promises_list = []
    plans_list = []
    if case_ids:
        promises = db.execute(
            select(Promise)
            .where(Promise.case_id.in_(case_ids))
            .order_by(Promise.due_date.desc())
        ).scalars().all()
        promises_list = [
            {
                "id": str(p.id),
                "case_id": str(p.case_id),
                "amount": float(p.amount),
                "due_date": p.due_date.isoformat(),
                "status": p.status,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in promises
        ]

        plans = db.execute(
            select(PaymentPlan)
            .where(PaymentPlan.case_id.in_(case_ids))
            .order_by(PaymentPlan.start_date.desc())
        ).scalars().all()
        plans_list = [
            {
                "id": str(pl.id),
                "case_id": str(pl.case_id),
                "deposit_amount": float(pl.deposit_amount),
                "installment_amount": float(pl.installment_amount),
                "frequency": pl.frequency,
                "number_of_installments": pl.number_of_installments,
                "status": pl.status,
                "start_date": pl.start_date.isoformat(),
            }
            for pl in plans
        ]

    payments = db.execute(
        select(Payment)
        .where(
            Payment.account_id == account_id,
            Payment.tenant_id == tenant_id,
        )
        .order_by(Payment.payment_date.desc())
    ).scalars().all()

    payments_list = [
        {
            "id": str(pm.id),
            "amount": float(pm.amount),
            "payment_date": pm.payment_date.isoformat(),
            "external_reference": pm.external_reference,
            "reconciliation_status": pm.reconciliation_status,
            "posted_at": pm.posted_at.isoformat() if pm.posted_at else None,
            "created_at": pm.created_at.isoformat() if pm.created_at else None,
        }
        for pm in payments
    ]

    return {
        "id": account.id,
        "tenant_id": account.tenant_id,
        "account_number": account.account_number,
        "account_status": account.account_status,
        "balance": account.balance,
        "arrears": account.arrears,
        "days_in_arrears": account.days_in_arrears,
        "last_payment_date": account.last_payment_date,
        "last_payment_amount": account.last_payment_amount,
        "customer": customer,
        "property": prop,
        "active_case": active_case,
        "cases": [
            {
                "id": str(c.id),
                "status": c.status,
                "priority": c.priority,
                "strategy_code": c.strategy_code,
                "assigned_to": c.assigned_to,
                "opened_at": c.opened_at.isoformat() if c.opened_at else None,
                "closed_at": c.closed_at.isoformat() if c.closed_at else None,
            }
            for c in cases
        ],
        "payments": payments_list,
        "promises": promises_list,
        "payment_plans": plans_list,
    }


# ---------------------------------------------------------
# Collection Cases
# ---------------------------------------------------------

@router.post(
    "/cases",
    response_model=CollectionCaseResponse,
)
def create_case(
    payload: CollectionCaseCreate,
    db: Session = Depends(get_db),
):
    account = db.execute(
        select(MunicipalAccount)
        .where(
            MunicipalAccount.id == payload.account_id,
            MunicipalAccount.tenant_id == payload.tenant_id,
        )
    ).scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=404,
            detail="Municipal account not found",
        )

    case = CollectionCase(
        id=uuid.uuid4(),
        tenant_id=payload.tenant_id,
        account_id=payload.account_id,
        status=payload.status,
        priority=payload.priority,
        strategy_code=payload.strategy_code,
        assigned_to=payload.assigned_to,
        opened_at=datetime.now(timezone.utc),
    )

    db.add(case)
    db.commit()
    db.refresh(case)

    return case


@router.get(
    "/cases",
    response_model=list[CollectionCaseResponse],
)
def list_cases(
    tenant_id: UUID,
    db: Session = Depends(get_db),
):
    return db.execute(
        select(CollectionCase)
        .where(
            CollectionCase.tenant_id == tenant_id
        )
        .order_by(
            CollectionCase.priority.desc(),
            CollectionCase.opened_at.desc(),
        )
    ).scalars().all()


@router.get(
    "/cases/{case_id}",
    response_model=CollectionCaseResponse,
)
def get_case(
    case_id: UUID,
    tenant_id: UUID,
    db: Session = Depends(get_db),
):
    case = db.execute(
        select(CollectionCase)
        .where(
            CollectionCase.id == case_id,
            CollectionCase.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Collection case not found",
        )

    return case


# ---------------------------------------------------------
# Collection Case Workflow
# ---------------------------------------------------------

CASE_TRANSITIONS = {
    "NEW": {
        "VALIDATED",
        "CONTACT_ATTEMPTED",
    },
    "VALIDATED": {
        "CONTACT_ATTEMPTED",
        "DISPUTED",
    },
    "CONTACT_ATTEMPTED": {
        "CONTACT_ATTEMPTED",
        "ENGAGED",
        "ESCALATED",
    },
    "ENGAGED": {
        "PROMISE_TO_PAY",
        "PAYMENT_ARRANGEMENT",
        "DISPUTED",
        "ESCALATED",
    },
    "PROMISE_TO_PAY": {
        "PAYING",
        "BROKEN_PROMISE",
        "ESCALATED",
    },
    "PAYMENT_ARRANGEMENT": {
        "PAYING",
        "BROKEN_PROMISE",
        "ESCALATED",
    },
    "PAYING": {
        "PAID",
        "BROKEN_PROMISE",
        "ESCALATED",
    },
    "BROKEN_PROMISE": {
        "ENGAGED",
        "PAYMENT_ARRANGEMENT",
        "ESCALATED",
    },
    "ESCALATED": {
        "ENGAGED",
        "PAYMENT_ARRANGEMENT",
        "DISPUTED",
        "CLOSED",
    },
    "DISPUTED": {
        "ENGAGED",
        "ESCALATED",
        "CLOSED",
    },
    "PAID": {
        "CLOSED",
    },
    "CLOSED": set(),
}


@router.patch(
    "/cases/{case_id}/status",
    response_model=CollectionCaseResponse,
)
def update_case_status(
    case_id: UUID,
    tenant_id: UUID,
    payload: CaseStatusUpdate,
    db: Session = Depends(get_db),
):
    case = db.execute(
        select(CollectionCase)
        .where(
            CollectionCase.id == case_id,
            CollectionCase.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Collection case not found",
        )

    allowed_next_states = CASE_TRANSITIONS.get(case.status, set())
    if payload.status not in allowed_next_states:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid transition: "
                f"{case.status} -> {payload.status}. "
                f"Allowed states: {sorted(allowed_next_states)}"
            ),
        )

    old_status = case.status
    case.status = payload.status

    if payload.status == "CLOSED":
        case.closed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(case)

    # Create audit event
    audit_event = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        actor=payload.actor,
        event_type="CASE_STATUS_CHANGED",
        entity_type="collection_case",
        entity_id=case.id,
        payload={
            "old_status": old_status,
            "new_status": payload.status,
            "notes": payload.notes,
        },
        created_at=datetime.now(timezone.utc),
    )

    db.add(audit_event)
    db.commit()

    return case


@router.get(
    "/cases/{case_id}/history",
    response_model=list[AuditEventResponse],
)
def case_history(
    case_id: UUID,
    tenant_id: UUID,
    db: Session = Depends(get_db),
):
    case = db.execute(
        select(CollectionCase)
        .where(
            CollectionCase.id == case_id,
            CollectionCase.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Collection case not found",
        )

    events = db.execute(
        select(AuditEvent)
        .where(
            AuditEvent.tenant_id == tenant_id,
            AuditEvent.entity_type == "collection_case",
            AuditEvent.entity_id == case_id,
        )
        .order_by(AuditEvent.created_at.desc())
    ).scalars().all()

    return events


# ---------------------------------------------------------
# Promise to Pay
# ---------------------------------------------------------

@router.post(
    "/cases/{case_id}/promises",
)
def create_promise(
    case_id: UUID,
    tenant_id: UUID,
    payload: PromiseCreate,
    db: Session = Depends(get_db),
):
    case = db.execute(
        select(CollectionCase)
        .where(
            CollectionCase.id == case_id,
            CollectionCase.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Collection case not found",
        )

    if payload.amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Promise amount must be greater than zero.",
        )

    # -----------------------------------------------------
    # Create promise
    # -----------------------------------------------------
    promise = Promise(
        id=uuid.uuid4(),
        case_id=case.id,
        amount=payload.amount,
        due_date=payload.due_date,
        status="PENDING",
        created_at=datetime.now(timezone.utc),
    )
    db.add(promise)

    # -----------------------------------------------------
    # Update case
    # -----------------------------------------------------
    old_status = case.status
    case.status = "PROMISE_TO_PAY"

    # -----------------------------------------------------
    # Audit
    # -----------------------------------------------------
    db.add(
        AuditEvent(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            actor=payload.actor,
            event_type="PROMISE_CREATED",
            entity_type="promise",
            entity_id=promise.id,
            payload={
                "case_id": str(case.id),
                "amount": str(payload.amount),
                "due_date": payload.due_date.isoformat(),
                "old_case_status": old_status,
                "new_case_status": "PROMISE_TO_PAY",
            },
            created_at=datetime.now(timezone.utc),
        )
    )

    db.commit()
    db.refresh(promise)

    return {
        "id": promise.id,
        "case_id": promise.case_id,
        "amount": promise.amount,
        "due_date": promise.due_date,
        "status": promise.status,
    }


# ---------------------------------------------------------
# List Promises
# ---------------------------------------------------------

@router.get(
    "/cases/{case_id}/promises",
)
def get_promises(
    case_id: UUID,
    tenant_id: UUID,
    db: Session = Depends(get_db),
):
    case = db.execute(
        select(CollectionCase)
        .where(
            CollectionCase.id == case_id,
            CollectionCase.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Collection case not found",
        )

    promises = db.execute(
        select(Promise)
        .where(
            Promise.case_id == case_id
        )
        .order_by(
            Promise.due_date.desc()
        )
    ).scalars().all()

    return [
        {
            "id": promise.id,
            "case_id": promise.case_id,
            "amount": promise.amount,
            "due_date": promise.due_date,
            "status": promise.status,
            "created_at": promise.created_at,
        }
        for promise in promises
    ]


# ---------------------------------------------------------
# Update Promise Status
# ---------------------------------------------------------

@router.patch(
    "/promises/{promise_id}/status",
)
def update_promise_status(
    promise_id: UUID,
    tenant_id: UUID,
    payload: PromiseStatusUpdate,
    db: Session = Depends(get_db),
):
    promise = db.execute(
        select(Promise)
        .join(
            CollectionCase,
            CollectionCase.id == Promise.case_id,
        )
        .where(
            Promise.id == promise_id,
            CollectionCase.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not promise:
        raise HTTPException(
            status_code=404,
            detail="Promise not found",
        )

    try:
        new_status = validate_promise_status(
            payload.status
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    old_status = promise.status
    promise.status = new_status

    # -----------------------------------------------------
    # Update case based on PTP result
    # -----------------------------------------------------
    case = db.execute(
        select(CollectionCase)
        .where(
            CollectionCase.id == promise.case_id
        )
    ).scalar_one()

    if new_status == "KEPT":
        case.status = "PAYING"
    elif new_status == "BROKEN":
        case.status = "BROKEN_PROMISE"
    elif new_status == "CANCELLED":
        case.status = "ENGAGED"

    db.add(
        AuditEvent(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            actor=payload.actor,
            event_type="PROMISE_STATUS_CHANGED",
            entity_type="promise",
            entity_id=promise.id,
            payload={
                "old_status": old_status,
                "new_status": new_status,
                "reason": payload.reason,
                "case_id": str(case.id),
            },
            created_at=datetime.now(timezone.utc),
        )
    )

    db.commit()

    return {
        "promise_id": promise.id,
        "old_status": old_status,
        "new_status": new_status,
        "case_status": case.status,
    }


# ---------------------------------------------------------
# Create Payment Plan
# ---------------------------------------------------------

@router.post(
    "/cases/{case_id}/payment-plans",
)
def create_payment_plan(
    case_id: UUID,
    tenant_id: UUID,
    payload: PaymentPlanCreate,
    db: Session = Depends(get_db),
):
    case = db.execute(
        select(CollectionCase)
        .where(
            CollectionCase.id == case_id,
            CollectionCase.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Collection case not found",
        )

    account = db.execute(
        select(MunicipalAccount)
        .where(
            MunicipalAccount.id == case.account_id
        )
    ).scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=404,
            detail="Municipal account not found",
        )

    if payload.deposit_amount < 0:
        raise HTTPException(
            status_code=400,
            detail="Deposit cannot be negative.",
        )

    if payload.deposit_amount > account.arrears:
        raise HTTPException(
            status_code=400,
            detail="Deposit cannot exceed arrears.",
        )

    if payload.installment_amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Installment amount must be greater than zero.",
        )

    if payload.number_of_installments <= 0:
        raise HTTPException(
            status_code=400,
            detail="Number of installments must be greater than zero.",
        )

    try:
        frequency = validate_frequency(
            payload.frequency
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    # -----------------------------------------------------
    # Check existing active plan
    # -----------------------------------------------------
    existing_plan = db.execute(
        select(PaymentPlan)
        .where(
            PaymentPlan.case_id == case_id,
            PaymentPlan.status == "ACTIVE",
        )
    ).scalar_one_or_none()

    if existing_plan:
        raise HTTPException(
            status_code=409,
            detail="Case already has an active payment plan.",
        )

    # -----------------------------------------------------
    # Create plan
    # -----------------------------------------------------
    plan = PaymentPlan(
        id=uuid.uuid4(),
        case_id=case.id,
        deposit_amount=payload.deposit_amount,
        installment_amount=payload.installment_amount,
        frequency=frequency,
        number_of_installments=payload.number_of_installments,
        status="ACTIVE",
        start_date=payload.start_date,
    )
    db.add(plan)

    old_status = case.status
    case.status = "PAYMENT_ARRANGEMENT"

    # -----------------------------------------------------
    # Audit
    # -----------------------------------------------------
    db.add(
        AuditEvent(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            actor=payload.actor,
            event_type="PAYMENT_PLAN_CREATED",
            entity_type="payment_plan",
            entity_id=plan.id,
            payload={
                "case_id": str(case.id),
                "deposit_amount": str(
                    payload.deposit_amount
                ),
                "installment_amount": str(
                    payload.installment_amount
                ),
                "frequency": frequency,
                "number_of_installments": (
                    payload.number_of_installments
                ),
                "start_date": (
                    payload.start_date.isoformat()
                ),
                "old_case_status": old_status,
                "new_case_status": (
                    "PAYMENT_ARRANGEMENT"
                ),
            },
            created_at=datetime.now(timezone.utc),
        )
    )

    db.commit()
    db.refresh(plan)

    return {
        "id": plan.id,
        "case_id": plan.case_id,
        "deposit_amount": plan.deposit_amount,
        "installment_amount": plan.installment_amount,
        "frequency": plan.frequency,
        "number_of_installments": (
            plan.number_of_installments
        ),
        "status": plan.status,
        "start_date": plan.start_date,
    }


# ---------------------------------------------------------
# List Payment Plans
# ---------------------------------------------------------

@router.get(
    "/cases/{case_id}/payment-plans",
)
def get_payment_plans(
    case_id: UUID,
    tenant_id: UUID,
    db: Session = Depends(get_db),
):
    case = db.execute(
        select(CollectionCase)
        .where(
            CollectionCase.id == case_id,
            CollectionCase.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Collection case not found",
        )

    plans = db.execute(
        select(PaymentPlan)
        .where(
            PaymentPlan.case_id == case_id
        )
        .order_by(
            PaymentPlan.start_date.desc()
        )
    ).scalars().all()

    return [
        {
            "id": plan.id,
            "case_id": plan.case_id,
            "deposit_amount": plan.deposit_amount,
            "installment_amount": plan.installment_amount,
            "frequency": plan.frequency,
            "number_of_installments": (
                plan.number_of_installments
            ),
            "status": plan.status,
            "start_date": plan.start_date,
        }
        for plan in plans
    ]


# ---------------------------------------------------------
# Update Payment Plan Status
# ---------------------------------------------------------

@router.patch(
    "/payment-plans/{plan_id}/status",
)
def update_payment_plan_status(
    plan_id: UUID,
    tenant_id: UUID,
    payload: PaymentPlanStatusUpdate,
    db: Session = Depends(get_db),
):
    plan = db.execute(
        select(PaymentPlan)
        .join(
            CollectionCase,
            CollectionCase.id == PaymentPlan.case_id,
        )
        .where(
            PaymentPlan.id == plan_id,
            CollectionCase.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not plan:
        raise HTTPException(
            status_code=404,
            detail="Payment plan not found",
        )

    try:
        new_status = validate_plan_status(
            payload.status
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    old_status = plan.status
    plan.status = new_status

    case = db.execute(
        select(CollectionCase)
        .where(
            CollectionCase.id == plan.case_id
        )
    ).scalar_one()

    if new_status == "COMPLETED":
        case.status = "PAID"
    elif new_status == "BROKEN":
        case.status = "BROKEN_PROMISE"
    elif new_status == "CANCELLED":
        case.status = "ENGAGED"

    db.add(
        AuditEvent(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            actor=payload.actor,
            event_type="PAYMENT_PLAN_STATUS_CHANGED",
            entity_type="payment_plan",
            entity_id=plan.id,
            payload={
                "old_status": old_status,
                "new_status": new_status,
                "reason": payload.reason,
                "case_id": str(case.id),
            },
            created_at=datetime.now(timezone.utc),
        )
    )

    db.commit()

    return {
        "plan_id": plan.id,
        "old_status": old_status,
        "new_status": new_status,
        "case_status": case.status,
    }


# ---------------------------------------------------------
# Payment Plan Calculator
# ---------------------------------------------------------

@router.get(
    "/cases/{case_id}/payment-plan-calculator",
)
def payment_plan_calculator(
    case_id: UUID,
    tenant_id: UUID,
    deposit_amount: Decimal,
    installment_amount: Decimal,
    db: Session = Depends(get_db),
):
    case = db.execute(
        select(CollectionCase)
        .where(
            CollectionCase.id == case_id,
            CollectionCase.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Collection case not found",
        )

    account = db.execute(
        select(MunicipalAccount)
        .where(
            MunicipalAccount.id == case.account_id
        )
    ).scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=404,
            detail="Municipal account not found",
        )

    if deposit_amount < 0:
        raise HTTPException(
            status_code=400,
            detail="Deposit cannot be negative.",
        )

    if installment_amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Installment amount must be greater than zero.",
        )

    if deposit_amount > account.arrears:
        raise HTTPException(
            status_code=400,
            detail="Deposit cannot exceed arrears.",
        )

    remaining = (
        account.arrears - deposit_amount
    )

    if remaining <= 0:
        installments = 0
        final_installment = Decimal("0.00")
    else:
        from math import ceil
        installments = ceil(
            float(
                remaining / installment_amount
            )
        )
        final_installment = (
            remaining - (
                installment_amount * (installments - 1)
            )
        )

    return {
        "arrears": account.arrears,
        "deposit_amount": deposit_amount,
        "remaining_balance": remaining,
        "installment_amount": installment_amount,
        "number_of_installments": installments,
        "final_installment": final_installment,
    }


# ---------------------------------------------------------
# Create Payment
# ---------------------------------------------------------

@router.post("/payments")
def create_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
):
    # -----------------------------------------------------
    # Validate tenant
    # -----------------------------------------------------
    tenant = db.execute(
        select(Tenant)
        .where(
            Tenant.id == payload.tenant_id
        )
    ).scalar_one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=404,
            detail="Tenant not found.",
        )

    # -----------------------------------------------------
    # Validate amount
    # -----------------------------------------------------
    if payload.amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Payment amount must be greater than zero.",
        )

    # -----------------------------------------------------
    # Validate account
    # -----------------------------------------------------
    account = db.execute(
        select(MunicipalAccount)
        .where(
            MunicipalAccount.id == payload.account_id,
            MunicipalAccount.tenant_id == payload.tenant_id,
        )
    ).scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=404,
            detail="Municipal account not found.",
        )

    # -----------------------------------------------------
    # Duplicate prevention
    # -----------------------------------------------------
    if payload.external_reference:
        existing = db.execute(
            select(Payment)
            .where(
                Payment.tenant_id == payload.tenant_id,
                Payment.external_reference == payload.external_reference,
            )
        ).scalar_one_or_none()

        if existing:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Payment already exists for "
                    f"external reference "
                    f"{payload.external_reference}."
                ),
            )

    # -----------------------------------------------------
    # Create payment
    # -----------------------------------------------------
    payment = Payment(
        id=uuid.uuid4(),
        tenant_id=payload.tenant_id,
        account_id=payload.account_id,
        amount=payload.amount,
        payment_date=payload.payment_date,
        external_reference=payload.external_reference,
        reconciliation_status="UNRECONCILED",
        created_at=datetime.now(timezone.utc),
    )

    db.add(payment)
    db.commit()
    db.refresh(payment)

    return {
        "id": payment.id,
        "tenant_id": payment.tenant_id,
        "account_id": payment.account_id,
        "amount": payment.amount,
        "payment_date": payment.payment_date,
        "external_reference": (
            payment.external_reference
        ),
        "reconciliation_status": (
            payment.reconciliation_status
        ),
    }


# ---------------------------------------------------------
# Unreconciled Payments
# ---------------------------------------------------------

@router.get("/payments/unreconciled")
def unreconciled_payments(
    tenant_id: UUID,
    db: Session = Depends(get_db),
):
    payments = db.execute(
        select(Payment)
        .where(
            Payment.tenant_id == tenant_id,
            Payment.reconciliation_status == "UNRECONCILED",
        )
        .order_by(
            Payment.payment_date.asc()
        )
    ).scalars().all()

    return [
        {
            "id": payment.id,
            "account_id": payment.account_id,
            "amount": payment.amount,
            "payment_date": payment.payment_date,
            "external_reference": (
                payment.external_reference
            ),
            "reconciliation_status": (
                payment.reconciliation_status
            ),
        }
        for payment in payments
    ]


# ---------------------------------------------------------
# Reconcile Payment
# ---------------------------------------------------------

@router.post(
    "/payments/{payment_id}/reconcile"
)
def reconcile_payment(
    payment_id: UUID,
    payload: PaymentReconciliation,
    db: Session = Depends(get_db),
):
    # -----------------------------------------------------
    # Get payment
    # -----------------------------------------------------
    payment = db.execute(
        select(Payment)
        .where(
            Payment.id == payment_id,
            Payment.tenant_id == payload.tenant_id,
        )
    ).scalar_one_or_none()

    if not payment:
        raise HTTPException(
            status_code=404,
            detail="Payment not found.",
        )

    # -----------------------------------------------------
    # Prevent double reconciliation
    # -----------------------------------------------------
    if (
        payment.reconciliation_status == "RECONCILED"
    ):
        raise HTTPException(
            status_code=409,
            detail="Payment has already been reconciled.",
        )

    # -----------------------------------------------------
    # Get account
    # -----------------------------------------------------
    account = db.execute(
        select(MunicipalAccount)
        .where(
            MunicipalAccount.id == payment.account_id,
            MunicipalAccount.tenant_id == payload.tenant_id,
        )
    ).scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=404,
            detail="Municipal account not found.",
        )

    # -----------------------------------------------------
    # Store old values
    # -----------------------------------------------------
    old_balance = account.balance
    old_arrears = account.arrears

    # -----------------------------------------------------
    # Apply payment
    # -----------------------------------------------------
    (
        account.balance,
        account.arrears,
    ) = apply_payment_to_account(
        account.balance,
        account.arrears,
        payment.amount,
    )

    account.last_payment_date = (
        payment.payment_date
    )
    account.last_payment_amount = (
        payment.amount
    )

    # -----------------------------------------------------
    # Mark payment reconciled
    # -----------------------------------------------------
    payment.reconciliation_status = (
        "RECONCILED"
    )

    # -----------------------------------------------------
    # Find active collection case
    # -----------------------------------------------------
    case = db.execute(
        select(CollectionCase)
        .where(
            CollectionCase.account_id == account.id,
            CollectionCase.tenant_id == payload.tenant_id,
            CollectionCase.status.notin_(
                ["PAID", "CLOSED"]
            ),
        )
        .order_by(
            CollectionCase.opened_at.desc()
        )
    ).scalars().first()

    # -----------------------------------------------------
    # Update PTP
    # -----------------------------------------------------
    promise_updated = False
    if case:
        promise = db.execute(
            select(Promise)
            .where(
                Promise.case_id == case.id,
                Promise.status == "PENDING",
            )
            .order_by(
                Promise.due_date.asc()
            )
        ).scalars().first()

        if promise:
            if payment.amount >= promise.amount:
                promise.status = "KEPT"
                promise_updated = True

    # -----------------------------------------------------
    # Update payment plan
    # -----------------------------------------------------
    payment_plan_updated = False
    if case:
        plan = db.execute(
            select(PaymentPlan)
            .where(
                PaymentPlan.case_id == case.id,
                PaymentPlan.status == "ACTIVE",
            )
        ).scalar_one_or_none()

        if plan:
            payment_plan_updated = True
            if account.arrears <= Decimal("0.00"):
                plan.status = "COMPLETED"

    # -----------------------------------------------------
    # Update case
    # -----------------------------------------------------
    if case:
        if account.arrears <= Decimal("0.00"):
            case.status = "PAID"
        elif promise_updated:
            case.status = "PAYING"
        elif payment_plan_updated:
            case.status = (
                "PAYMENT_ARRANGEMENT"
            )
        else:
            case.status = "PAYING"

    # -----------------------------------------------------
    # Audit event
    # -----------------------------------------------------
    db.add(
        AuditEvent(
            id=uuid.uuid4(),
            tenant_id=payload.tenant_id,
            actor=payload.actor,
            event_type="PAYMENT_RECONCILED",
            entity_type="payment",
            entity_id=payment.id,
            payload={
                "account_id": str(
                    account.id
                ),
                "amount": str(
                    payment.amount
                ),
                "old_balance": str(
                    old_balance
                ),
                "new_balance": str(
                    account.balance
                ),
                "old_arrears": str(
                    old_arrears
                ),
                "new_arrears": str(
                    account.arrears
                ),
                "case_id": (
                    str(case.id)
                    if case
                    else None
                ),
                "promise_updated": (
                    promise_updated
                ),
                "payment_plan_updated": (
                    payment_plan_updated
                ),
            },
            created_at=datetime.now(
                timezone.utc
            ),
        )
    )

    db.commit()

    return {
        "payment_id": payment.id,
        "status": "RECONCILED",
        "amount": payment.amount,
        "old_balance": old_balance,
        "new_balance": account.balance,
        "old_arrears": old_arrears,
        "new_arrears": account.arrears,
        "case_status": (
            case.status
            if case
            else None
        ),
        "promise_updated": promise_updated,
        "payment_plan_updated": (
            payment_plan_updated
        ),
    }


# ---------------------------------------------------------
# Account Payment History
# ---------------------------------------------------------

@router.get(
    "/accounts/{account_id}/payments"
)
def account_payments(
    account_id: UUID,
    tenant_id: UUID,
    db: Session = Depends(get_db),
):
    account = db.execute(
        select(MunicipalAccount)
        .where(
            MunicipalAccount.id == account_id,
            MunicipalAccount.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=404,
            detail="Municipal account not found.",
        )

    payments = db.execute(
        select(Payment)
        .where(
            Payment.account_id == account_id,
            Payment.tenant_id == tenant_id,
        )
        .order_by(
            Payment.payment_date.desc()
        )
    ).scalars().all()

    return [
        {
            "id": payment.id,
            "amount": payment.amount,
            "payment_date": payment.payment_date,
            "external_reference": (
                payment.external_reference
            ),
            "reconciliation_status": (
                payment.reconciliation_status
            ),
            "created_at": payment.created_at,
        }
        for payment in payments
    ]


# ---------------------------------------------------------
# Payment Summary
# ---------------------------------------------------------

@router.get("/payments/summary")
def payment_summary(
    tenant_id: UUID,
    db: Session = Depends(get_db),
):
    payments = db.execute(
        select(Payment)
        .where(
            Payment.tenant_id == tenant_id
        )
    ).scalars().all()

    total = sum(
        (
            payment.amount
            for payment in payments
        ),
        Decimal("0.00"),
    )

    reconciled = sum(
        (
            payment.amount
            for payment in payments
            if payment.reconciliation_status
            == "RECONCILED"
        ),
        Decimal("0.00"),
    )

    unreconciled = sum(
        (
            payment.amount
            for payment in payments
            if payment.reconciliation_status
            != "RECONCILED"
        ),
        Decimal("0.00"),
    )

    return {
        "payment_count": len(payments),
        "total_payments": total,
        "reconciled_amount": reconciled,
        "unreconciled_amount": unreconciled,
    }


# ---------------------------------------------------------
# Collections Work Queue
# ---------------------------------------------------------

@router.get(
    "/work-queue",
    response_model=list[WorkQueueItem],
)
def get_work_queue(
    tenant_id: UUID,
    assigned_to: str | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    if limit < 1 or limit > 500:
        raise HTTPException(
            status_code=400,
            detail="limit must be between 1 and 500",
        )

    query = (
        select(
            CollectionCase,
            MunicipalAccount,
            Customer,
        )
        .join(
            MunicipalAccount,
            MunicipalAccount.id == CollectionCase.account_id,
        )
        .outerjoin(
            Customer,
            Customer.id == MunicipalAccount.customer_id,
        )
        .where(
            CollectionCase.tenant_id == tenant_id,
            CollectionCase.status.notin_(
                ["PAID", "CLOSED"]
            ),
        )
    )

    if assigned_to:
        query = query.where(
            CollectionCase.assigned_to == assigned_to
        )

    results = db.execute(query).all()

    queue = []

    for case, account, customer in results:
        # -------------------------------------------------
        # Find active promise
        # -------------------------------------------------
        promise = db.execute(
            select(Promise)
            .where(
                Promise.case_id == case.id,
                Promise.status == "PENDING",
            )
            .order_by(
                Promise.due_date.asc()
            )
        ).scalars().first()

        priority_score = calculate_priority_score(
            case=case,
            account=account,
            promise=promise,
        )

        next_action = determine_next_action(
            case=case,
            promise=promise,
        )

        customer_name = None
        if customer:
            customer_name = " ".join(
                part
                for part in [
                    customer.first_name,
                    customer.last_name,
                ]
                if part
            )

        queue.append(
            WorkQueueItem(
                case_id=case.id,
                account_id=account.id,
                account_number=account.account_number,
                customer_id=(
                    customer.id
                    if customer
                    else None
                ),
                customer_name=customer_name,
                mobile=(
                    customer.mobile
                    if customer
                    else None
                ),
                arrears=account.arrears,
                balance=account.balance,
                days_in_arrears=account.days_in_arrears,
                case_status=case.status,
                case_priority=case.priority,
                strategy_code=case.strategy_code,
                assigned_to=case.assigned_to,
                next_action=next_action,
                priority_score=priority_score,
                promise_due_date=(
                    promise.due_date
                    if promise
                    else None
                ),
                promise_amount=(
                    promise.amount
                    if promise
                    else None
                ),
                promise_status=(
                    promise.status
                    if promise
                    else None
                ),
            )
        )

    # -----------------------------------------------------
    # Highest priority first
    # -----------------------------------------------------
    queue.sort(
        key=lambda item: (
            -item.priority_score,
            -float(item.arrears),
            -item.days_in_arrears,
        )
    )

    return queue[:limit]


@router.patch(
    "/cases/{case_id}/assignment"
)
def assign_case(
    case_id: UUID,
    tenant_id: UUID,
    payload: CaseAssignmentUpdate,
    db: Session = Depends(get_db),
):
    case = db.execute(
        select(CollectionCase)
        .where(
            CollectionCase.id == case_id,
            CollectionCase.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Collection case not found",
        )

    old_assignee = case.assigned_to
    case.assigned_to = payload.assigned_to

    db.add(
        AuditEvent(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            actor=payload.actor,
            event_type="CASE_ASSIGNED",
            entity_type="collection_case",
            entity_id=case.id,
            payload={
                "old_assignee": old_assignee,
                "new_assignee": payload.assigned_to,
            },
            created_at=datetime.now(timezone.utc),
        )
    )

    db.commit()

    return {
        "case_id": case.id,
        "assigned_to": case.assigned_to,
    }


@router.get("/work-queue/summary")
def work_queue_summary(
    tenant_id: UUID,
    assigned_to: str | None = None,
    db: Session = Depends(get_db),
):
    query = (
        select(CollectionCase)
        .where(
            CollectionCase.tenant_id == tenant_id,
            CollectionCase.status.notin_(
                ["PAID", "CLOSED"]
            ),
        )
    )

    if assigned_to:
        query = query.where(
            CollectionCase.assigned_to == assigned_to
        )

    cases = db.execute(query).scalars().all()

    summary = {
        "total_cases": len(cases),
        "new": 0,
        "contact_attempted": 0,
        "engaged": 0,
        "promise_to_pay": 0,
        "paying": 0,
        "broken_promises": 0,
        "escalated": 0,
        "disputed": 0,
    }

    for case in cases:
        if case.status == "NEW":
            summary["new"] += 1
        elif case.status == "CONTACT_ATTEMPTED":
            summary["contact_attempted"] += 1
        elif case.status == "ENGAGED":
            summary["engaged"] += 1
        elif case.status == "PROMISE_TO_PAY":
            summary["promise_to_pay"] += 1
        elif case.status == "PAYING":
            summary["paying"] += 1
        elif case.status == "BROKEN_PROMISE":
            summary["broken_promises"] += 1
        elif case.status == "ESCALATED":
            summary["escalated"] += 1
    return summary


# ---------------------------------------------------------
# Collector: Record Contact Attempt
# ---------------------------------------------------------

@router.post(
    "/cases/{case_id}/contacts",
)
def record_contact_attempt(
    case_id: UUID,
    tenant_id: UUID,
    payload: ContactAttemptCreate,
    db: Session = Depends(get_db),
):
    # -----------------------------------------------------
    # Find case
    # -----------------------------------------------------
    case = db.execute(
        select(CollectionCase)
        .where(
            CollectionCase.id == case_id,
            CollectionCase.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Collection case not found",
        )

    # -----------------------------------------------------
    # Validate channel
    # -----------------------------------------------------
    try:
        channel = validate_contact_channel(
            payload.channel
        )
        outcome = validate_contact_outcome(
            payload.outcome
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    # -----------------------------------------------------
    # Determine new case status
    # -----------------------------------------------------
    new_status = determine_case_status(outcome)
    old_status = case.status
    case.status = new_status

    # -----------------------------------------------------
    # Create audit event
    # -----------------------------------------------------
    event_id = uuid.uuid4()

    audit_payload = {
        "channel": channel,
        "outcome": outcome,
        "notes": payload.notes,
        "next_action": payload.next_action,
        "next_action_date": (
            payload.next_action_date.isoformat()
            if payload.next_action_date
            else None
        ),
        "old_status": old_status,
        "new_status": new_status,
    }

    audit_event = AuditEvent(
        id=event_id,
        tenant_id=tenant_id,
        actor=payload.actor,
        event_type="CONTACT_ATTEMPT",
        entity_type="collection_case",
        entity_id=case.id,
        payload=audit_payload,
        created_at=datetime.now(timezone.utc),
    )

    db.add(audit_event)
    db.commit()
    db.refresh(case)

    return {
        "contact_id": event_id,
        "case_id": case.id,
        "old_status": old_status,
        "new_status": case.status,
        "channel": channel,
        "outcome": outcome,
        "next_action": payload.next_action,
        "next_action_date": payload.next_action_date,
    }


# ---------------------------------------------------------
# Collector: Contact History
# ---------------------------------------------------------

@router.get(
    "/cases/{case_id}/contacts",
)
def get_contact_history(
    case_id: UUID,
    tenant_id: UUID,
    db: Session = Depends(get_db),
):
    # -----------------------------------------------------
    # Verify case belongs to tenant
    # -----------------------------------------------------
    case = db.execute(
        select(CollectionCase)
        .where(
            CollectionCase.id == case_id,
            CollectionCase.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Collection case not found",
        )

    # -----------------------------------------------------
    # Retrieve contact events
    # -----------------------------------------------------
    events = db.execute(
        select(AuditEvent)
        .where(
            AuditEvent.tenant_id == tenant_id,
            AuditEvent.entity_type == "collection_case",
            AuditEvent.entity_id == case_id,
            AuditEvent.event_type == "CONTACT_ATTEMPT",
        )
        .order_by(
            AuditEvent.created_at.desc()
        )
    ).scalars().all()

    history = []

    for event in events:
        payload = event.payload or {}
        history.append(
            {
                "id": event.id,
                "actor": event.actor,
                "channel": payload.get("channel"),
                "outcome": payload.get("outcome"),
                "notes": payload.get("notes"),
                "next_action": payload.get("next_action"),
                "next_action_date": payload.get(
                    "next_action_date"
                ),
                "created_at": event.created_at,
            }
        )

    return history


# ---------------------------------------------------------
# Import Engine
# ---------------------------------------------------------

@router.post("/imports/accounts/mapping")
async def account_import_mapping(
    file: UploadFile = File(...),
):
    content = await file.read()
    filename = (
        file.filename or ""
    ).lower()

    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(
                io.BytesIO(content),
                nrows=5,
            )
        elif filename.endswith(".xlsx"):
            df = pd.read_excel(
                io.BytesIO(content),
                nrows=5,
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Only CSV and XLSX "
                    "files are supported."
                ),
            )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read file: {exc}",
        ) from exc

    columns = list(df.columns)
    mapping, missing = validate_columns(
        columns
    )

    return {
        "columns": columns,
        "mapping": mapping,
        "missing_required": missing,
        "valid": not missing,
    }


@router.post("/imports/accounts")
async def import_accounts_endpoint(
    tenant_id: UUID,
    actor: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    content = await file.read()
    filename = (
        file.filename or ""
    ).lower()

    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(
                io.BytesIO(content)
            )
        elif filename.endswith(".xlsx"):
            df = pd.read_excel(
                io.BytesIO(content)
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Only CSV and XLSX "
                    "files are supported."
                ),
            )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read file: {exc}",
        ) from exc

    if df.empty:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty.",
        )

    df = df.fillna("")
    rows = df.to_dict(
        orient="records"
    )

    try:
        result = import_accounts(
            db=db,
            tenant_id=tenant_id,
            rows=rows,
            actor=actor,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    return {
        "filename": file.filename,
        **result,
    }


# ---------------------------------------------------------
# Collections Case Engine: Automatic Case Generation
# ---------------------------------------------------------

@router.post(
    "/cases/generate",
    response_model=CaseGenerationResult,
)
def generate_collection_cases_endpoint(
    payload: CaseGenerationRequest,
    db: Session = Depends(get_db),
):
    try:
        result = generate_cases_for_tenant(
            db=db,
            tenant_id=payload.tenant_id,
            min_arrears=payload.min_arrears,
            min_days_in_arrears=payload.min_days_in_arrears,
            actor=payload.actor,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    return result