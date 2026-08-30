import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Tenant,
    MunicipalAccount,
    CollectionCase,
    AuditEvent,
)


def determine_case_priority_and_strategy(
    arrears: Decimal,
    days_in_arrears: int,
) -> tuple[int, str]:
    """
    Determines priority (1-5) and strategy_code based on arrears and days in arrears.
    """
    if arrears >= Decimal("50000.00") or days_in_arrears >= 180:
        return 5, "LEGAL_PRE_ACTION"
    elif arrears >= Decimal("20000.00") or days_in_arrears >= 120:
        return 4, "HIGH_VALUE"
    elif arrears >= Decimal("10000.00") or days_in_arrears >= 90:
        return 3, "STANDARD_INTENSIVE"
    elif arrears >= Decimal("5000.00") or days_in_arrears >= 60:
        return 2, "STANDARD"
    else:
        return 1, "EARLY_STAGE"


def generate_or_update_case_for_account(
    db: Session,
    account: MunicipalAccount,
    tenant_id: uuid.UUID,
    min_arrears: Decimal = Decimal("500.00"),
    min_days_in_arrears: int = 30,
    actor: str = "system",
) -> tuple[CollectionCase | None, str]:
    """
    Evaluates a single MunicipalAccount and generates, updates, or closes a CollectionCase.
    Returns (case, action_taken) where action_taken is one of:
    'CREATED', 'UPDATED', 'CLOSED', 'SKIPPED'
    """
    # Look for an existing open case for this account
    existing_case = db.execute(
        select(CollectionCase)
        .where(
            CollectionCase.account_id == account.id,
            CollectionCase.tenant_id == tenant_id,
            CollectionCase.status.notin_(["PAID", "CLOSED"]),
        )
        .order_by(CollectionCase.opened_at.desc())
    ).scalars().first()

    priority, strategy = determine_case_priority_and_strategy(
        account.arrears,
        account.days_in_arrears,
    )

    # Check eligibility for collections
    is_eligible = (
        account.account_status == "ACTIVE"
        and account.arrears >= min_arrears
        and account.days_in_arrears >= min_days_in_arrears
    )

    if not is_eligible:
        if existing_case:
            # If arrears are 0 or cleared, mark as PAID/CLOSED
            if account.arrears <= Decimal("0.00"):
                old_status = existing_case.status
                existing_case.status = "PAID"
                existing_case.closed_at = datetime.now(timezone.utc)
                db.add(
                    AuditEvent(
                        id=uuid.uuid4(),
                        tenant_id=tenant_id,
                        actor=actor,
                        event_type="CASE_CLOSED_ARREARS_CLEARED",
                        entity_type="collection_case",
                        entity_id=existing_case.id,
                        payload={
                            "old_status": old_status,
                            "new_status": "PAID",
                            "arrears": str(account.arrears),
                        },
                        created_at=datetime.now(timezone.utc),
                    )
                )
                db.flush()
                return existing_case, "CLOSED"
        return None, "SKIPPED"

    if existing_case:
        # Case already exists: sync priority and strategy if changed
        changed = False
        old_priority = existing_case.priority
        old_strategy = existing_case.strategy_code
        if existing_case.priority != priority:
            existing_case.priority = priority
            changed = True
        if existing_case.strategy_code != strategy:
            existing_case.strategy_code = strategy
            changed = True

        if changed:
            db.add(
                AuditEvent(
                    id=uuid.uuid4(),
                    tenant_id=tenant_id,
                    actor=actor,
                    event_type="CASE_STRATEGY_UPDATED",
                    entity_type="collection_case",
                    entity_id=existing_case.id,
                    payload={
                        "old_priority": old_priority,
                        "new_priority": priority,
                        "old_strategy": old_strategy,
                        "new_strategy": strategy,
                        "arrears": str(account.arrears),
                        "days_in_arrears": account.days_in_arrears,
                    },
                    created_at=datetime.now(timezone.utc),
                )
            )
            db.flush()
            return existing_case, "UPDATED"
        return existing_case, "SKIPPED"

    # Create new collection case
    case_id = uuid.uuid4()
    case = CollectionCase(
        id=case_id,
        tenant_id=tenant_id,
        account_id=account.id,
        status="NEW",
        priority=priority,
        strategy_code=strategy,
        assigned_to=None,
        opened_at=datetime.now(timezone.utc),
        closed_at=None,
    )
    db.add(case)
    db.flush()

    db.add(
        AuditEvent(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            actor=actor,
            event_type="CASE_AUTO_GENERATED",
            entity_type="collection_case",
            entity_id=case_id,
            payload={
                "account_id": str(account.id),
                "account_number": account.account_number,
                "status": "NEW",
                "priority": priority,
                "strategy_code": strategy,
                "arrears": str(account.arrears),
                "days_in_arrears": account.days_in_arrears,
            },
            created_at=datetime.now(timezone.utc),
        )
    )
    db.flush()
    return case, "CREATED"


def generate_cases_for_tenant(
    db: Session,
    tenant_id: uuid.UUID,
    min_arrears: Decimal = Decimal("500.00"),
    min_days_in_arrears: int = 30,
    actor: str = "system",
) -> dict:
    """
    Scans all municipal accounts for a tenant and generates/updates collection cases.
    """
    tenant = db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    ).scalar_one_or_none()
    if not tenant:
        raise ValueError("Tenant not found.")

    accounts = db.execute(
        select(MunicipalAccount)
        .where(MunicipalAccount.tenant_id == tenant_id)
    ).scalars().all()

    created_count = 0
    updated_count = 0
    closed_count = 0
    skipped_count = 0
    eligible_count = 0

    for account in accounts:
        if (
            account.account_status == "ACTIVE"
            and account.arrears >= min_arrears
            and account.days_in_arrears >= min_days_in_arrears
        ):
            eligible_count += 1

        _, action = generate_or_update_case_for_account(
            db=db,
            account=account,
            tenant_id=tenant_id,
            min_arrears=min_arrears,
            min_days_in_arrears=min_days_in_arrears,
            actor=actor,
        )

        if action == "CREATED":
            created_count += 1
        elif action == "UPDATED":
            updated_count += 1
        elif action == "CLOSED":
            closed_count += 1
        elif action == "SKIPPED":
            skipped_count += 1

    db.commit()

    db.add(
        AuditEvent(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            actor=actor,
            event_type="CASE_GENERATION_RUN",
            entity_type="collection_case",
            entity_id=None,
            payload={
                "eligible_accounts": eligible_count,
                "cases_created": created_count,
                "cases_updated": updated_count,
                "cases_closed": closed_count,
                "skipped": skipped_count,
                "min_arrears": str(min_arrears),
                "min_days_in_arrears": min_days_in_arrears,
            },
            created_at=datetime.now(timezone.utc),
        )
    )
    db.commit()

    return {
        "tenant_id": tenant_id,
        "eligible_accounts": eligible_count,
        "cases_created": created_count,
        "cases_updated": updated_count,
        "cases_closed": closed_count,
        "skipped": skipped_count,
    }
