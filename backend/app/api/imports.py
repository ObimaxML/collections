from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.batch_import import (
    create_import_batch,
    import_validated_batch,
    validate_import_batch,
)


router = APIRouter(
    prefix="/imports",
    tags=["Batch Imports"],
)


@router.post("/batches")
def create_batch(
    tenant_id: UUID,
    file_name: str,
    source_type: str,
    rows: list[dict],
    created_by: str = "batch-import",
    db: Session = Depends(get_db),
):
    try:
        batch = create_import_batch(
            db=db,
            tenant_id=tenant_id,
            file_name=file_name,
            source_type=source_type,
            created_by=created_by,
            rows=rows,
        )

        return {
            "success": True,
            "batch_id": batch.id,
            "status": batch.status,
            "total_rows": batch.total_rows,
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.post(
    "/batches/{batch_id}/validate"
)
def validate_batch(
    batch_id: UUID,
    db: Session = Depends(get_db),
):
    try:
        return validate_import_batch(
            db=db,
            batch_id=batch_id,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc


@router.post(
    "/batches/{batch_id}/import"
)
def import_batch(
    batch_id: UUID,
    db: Session = Depends(get_db),
):
    try:
        return import_validated_batch(
            db=db,
            batch_id=batch_id,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc
