from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    CollectionCase,
    MunicipalAccount,
)


CASE_STATUSES = {
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
}


class CaseServiceError(Exception):
    pass


class CaseNotFoundError(CaseServiceError):
    pass


class AccountNotFoundError(CaseServiceError):
    pass


class InvalidCaseStatusError(CaseServiceError):
    pass


class CaseService:

    @staticmethod
    def get_case(
        db: Session,
        case_id: UUID,
    ) -> CollectionCase:

        case = db.execute(
            select(CollectionCase)
            .where(CollectionCase.id == case_id)
        ).scalar_one_or_none()

        if not case:
            raise CaseNotFoundError(
                f"Collection case {case_id} not found."
            )

        return case

    @staticmethod
    def create_case(
        db: Session,
        *,
        tenant_id: UUID,
        account_id: UUID,
        priority: int = 3,
        strategy_code: str | None = None,
        assigned_to: str | None = None,
        actor: str = "system",
    ) -> CollectionCase:

        account = db.execute(
            select(MunicipalAccount)
            .where(
                MunicipalAccount.id == account_id,
                MunicipalAccount.tenant_id == tenant_id,
            )
        ).scalar_one_or_none()

        if not account:
            raise AccountNotFoundError(
                f"Municipal account {account_id} not found."
            )

        existing_case = db.execute(
            select(CollectionCase)
            .where(
                CollectionCase.account_id == account_id,
                CollectionCase.status.not_in(
                    ["PAID", "CLOSED"]
                ),
            )
        ).scalar_one_or_none()

        if existing_case:
            return existing_case

        now = datetime.now(timezone.utc)

        case = CollectionCase(
            id=uuid4(),
            tenant_id=tenant_id,
            account_id=account_id,
            status="NEW",
            priority=priority,
            strategy_code=strategy_code,
            assigned_to=assigned_to,
            opened_at=now,
        )

        db.add(case)

        db.flush()

        db.add(
            AuditEvent(
                id=uuid4(),
                tenant_id=tenant_id,
                actor=actor,
                event_type="CASE_CREATED",
                entity_type="CollectionCase",
                entity_id=case.id,
                payload={
                    "account_id": str(account_id),
                    "priority": priority,
                    "strategy_code": strategy_code,
                    "assigned_to": assigned_to,
                },
                created_at=now,
            )
        )

        return case

    @staticmethod
    def assign_case(
        db: Session,
        *,
        case_id: UUID,
        assigned_to: str,
        actor: str,
    ) -> CollectionCase:

        case = CaseService.get_case(
            db,
            case_id,
        )

        old_assignee = case.assigned_to

        case.assigned_to = assigned_to

        db.add(
            AuditEvent(
                id=uuid4(),
                tenant_id=case.tenant_id,
                actor=actor,
                event_type="CASE_ASSIGNED",
                entity_type="CollectionCase",
                entity_id=case.id,
                payload={
                    "old_assignee": old_assignee,
                    "new_assignee": assigned_to,
                },
                created_at=datetime.now(
                    timezone.utc
                ),
            )
        )

        return case

    @staticmethod
    def change_status(
        db: Session,
        *,
        case_id: UUID,
        status: str,
        actor: str,
    ) -> CollectionCase:

        status = status.upper()

        if status not in CASE_STATUSES:
            raise InvalidCaseStatusError(
                f"Invalid case status: {status}"
            )

        case = CaseService.get_case(
            db,
            case_id,
        )

        old_status = case.status

        case.status = status

        if status in {"PAID", "CLOSED"}:
            case.closed_at = datetime.now(
                timezone.utc
            )
        else:
            case.closed_at = None

        db.add(
            AuditEvent(
                id=uuid4(),
                tenant_id=case.tenant_id,
                actor=actor,
                event_type="CASE_STATUS_CHANGED",
                entity_type="CollectionCase",
                entity_id=case.id,
                payload={
                    "old_status": old_status,
                    "new_status": status,
                },
                created_at=datetime.now(
                    timezone.utc
                ),
            )
        )

        return case

    @staticmethod
    def update_priority(
        db: Session,
        *,
        case_id: UUID,
        priority: int,
        actor: str,
    ) -> CollectionCase:

        if priority < 1 or priority > 5:
            raise ValueError(
                "Priority must be between 1 and 5."
            )

        case = CaseService.get_case(
            db,
            case_id,
        )

        old_priority = case.priority

        case.priority = priority

        db.add(
            AuditEvent(
                id=uuid4(),
                tenant_id=case.tenant_id,
                actor=actor,
                event_type="CASE_PRIORITY_CHANGED",
                entity_type="CollectionCase",
                entity_id=case.id,
                payload={
                    "old_priority": old_priority,
                    "new_priority": priority,
                },
                created_at=datetime.now(
                    timezone.utc
                ),
            )
        )

        return case
