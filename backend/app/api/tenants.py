from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Tenant
from app.schemas.tenants import TenantCreate, TenantResponse


router = APIRouter(
    prefix="/tenants",
    tags=["Municipal Tenants"],
)


@router.get(
    "",
    response_model=list[TenantResponse],
)
def list_tenants(
    db: Session = Depends(get_db),
):
    """
    List all onboarded municipalities / tenants.
    """
    statement = select(Tenant).order_by(Tenant.name.asc())
    return list(db.scalars(statement))


@router.post(
    "",
    response_model=TenantResponse,
    status_code=201,
)
def create_tenant(
    payload: TenantCreate,
    db: Session = Depends(get_db),
):
    """
    Onboard a new municipality into CollectionsOS.
    """
    code_upper = payload.code.strip().upper()

    existing = db.scalar(
        select(Tenant).where(Tenant.code == code_upper)
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Municipality with code '{code_upper}' already exists.",
        )

    tenant = Tenant(
        id=uuid4(),
        name=payload.name.strip(),
        code=code_upper,
        created_at=datetime.now(timezone.utc),
    )

    db.add(tenant)
    db.commit()
    db.refresh(tenant)

    return tenant


@router.get(
    "/{tenant_id}",
    response_model=TenantResponse,
)
def get_tenant(
    tenant_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Get municipality details by ID.
    """
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=404,
            detail="Municipality not found.",
        )
    return tenant
