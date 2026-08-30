from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import CollectionCase
from app.schemas.cases import (
    CaseAssignRequest,
    CaseCreateRequest,
    CasePriorityRequest,
    CaseResponse,
    CaseStatusRequest,
)
from app.services.case_service import (
    AccountNotFoundError,
    CaseNotFoundError,
    CaseService,
    InvalidCaseStatusError,
)


from app.services.case_detail import get_case_detail


router = APIRouter(
    prefix="/cases",
    tags=["Collection Cases"],
)


@router.get("/{case_id}")
def get_case(
    case_id: UUID,
    db: Session = Depends(get_db),
):
    try:
        return get_case_detail(
            db,
            case_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc


@router.post(
    "",
    response_model=CaseResponse,
)
def create_case(
    request: CaseCreateRequest,
    db: Session = Depends(get_db),
):

    try:

        case = CaseService.create_case(
            db,
            tenant_id=request.tenant_id,
            account_id=request.account_id,
            priority=request.priority,
            strategy_code=request.strategy_code,
            assigned_to=request.assigned_to,
            actor=request.actor,
        )

        db.commit()
        db.refresh(case)

        return case

    except AccountNotFoundError as exc:

        db.rollback()

        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )


@router.get(
    "",
    response_model=list[CaseResponse],
)
def list_cases(
    tenant_id: UUID | None = None,
    status: str | None = None,
    assigned_to: str | None = None,
    db: Session = Depends(get_db),
):

    query = select(CollectionCase)

    if tenant_id:
        query = query.where(
            CollectionCase.tenant_id
            == tenant_id
        )

    if status:
        query = query.where(
            CollectionCase.status
            == status.upper()
        )

    if assigned_to:
        query = query.where(
            CollectionCase.assigned_to
            == assigned_to
        )

    query = query.order_by(
        CollectionCase.priority.asc(),
        CollectionCase.opened_at.asc(),
    )

    return db.execute(
        query
    ).scalars().all()


@router.patch(
    "/{case_id}/assign",
    response_model=CaseResponse,
)
def assign_case(
    case_id: UUID,
    request: CaseAssignRequest,
    db: Session = Depends(get_db),
):

    try:

        case = CaseService.assign_case(
            db,
            case_id=case_id,
            assigned_to=request.assigned_to,
            actor=request.actor,
        )

        db.commit()
        db.refresh(case)

        return case

    except CaseNotFoundError as exc:

        db.rollback()

        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )


@router.patch(
    "/{case_id}/status",
    response_model=CaseResponse,
)
def change_case_status(
    case_id: UUID,
    request: CaseStatusRequest,
    db: Session = Depends(get_db),
):

    try:

        case = CaseService.change_status(
            db,
            case_id=case_id,
            status=request.status,
            actor=request.actor,
        )

        db.commit()
        db.refresh(case)

        return case

    except CaseNotFoundError as exc:

        db.rollback()

        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )

    except InvalidCaseStatusError as exc:

        db.rollback()

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


@router.patch(
    "/{case_id}/priority",
    response_model=CaseResponse,
)
def update_priority(
    case_id: UUID,
    request: CasePriorityRequest,
    db: Session = Depends(get_db),
):

    try:

        case = CaseService.update_priority(
            db,
            case_id=case_id,
            priority=request.priority,
            actor=request.actor,
        )

        db.commit()
        db.refresh(case)

        return case

    except CaseNotFoundError as exc:

        db.rollback()

        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )
