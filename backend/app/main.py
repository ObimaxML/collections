from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.api.cases import router as cases_router
from app.api.case_timeline import router as case_timeline_router
from app.api.promises import router as promises_router
from app.api.promise_monitoring import router as promise_monitoring_router
from app.api.payments import router as payments_router
from app.api.payment_imports import router as payment_imports_router
from app.api.work_queue import router as work_queue_router
from app.api.intelligence import router as intelligence_router
from app.api.case_intelligence import router as case_intelligence_router
from app.api.strategies import router as strategies_router
from app.api.activities import router as activities_router
from app.api.tenants import router as tenants_router
from app.api.ledger import router as ledger_router
from app.api.worklist import router as worklist_router
from app.api.case_actions import router as case_actions_router
from app.api.collection_activity import router as collection_activity_router
from app.api.payment_plans import router as payment_plans_router
from app.api.collectors import router as collectors_router
from app.api.contact_attempts import (
    router as contact_attempts_router,
)
from app.api.payment_reconciliation import (
    router as payment_reconciliation_router,
)
from app.api.financial import (
    router as financial_router,
)
from app.api.imports import router as imports_router
from app.api.popia import router as popia_router
from app.api.billing import router as billing_router
from app.core.config import settings
from app.db.session import Base

# Import models so SQLAlchemy knows about them
from app.models import (
    Tenant,
    User,
    Customer,
    Property,
    MunicipalAccount,
    CollectionCase,
    CollectionActivity,
    CaseActivity,
    Promise,
    PaymentPlan,
    Payment,
    AuditEvent,
    ContactAttempt,
    Proposal,
    Invoice,
)



app = FastAPI(
    title="CollectionsOS API",
    version="0.1.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(
    tenants_router,
    prefix="/api",
)
app.include_router(
    ledger_router,
    prefix="/api",
)
app.include_router(
    worklist_router,
    prefix="/api",
)
app.include_router(
    case_actions_router,
    prefix="/api",
)
app.include_router(
    collection_activity_router,
    prefix="/api",
)
app.include_router(
    promises_router,
    prefix="/api",
)
app.include_router(
    payment_plans_router,
    prefix="/api",
)
app.include_router(
    activities_router,
    prefix="/api",
)
app.include_router(
    strategies_router,
    prefix="/api",
)
app.include_router(
    case_intelligence_router,
    prefix="/api",
)
app.include_router(
    intelligence_router,
    prefix="/api",
)
app.include_router(
    work_queue_router,
    prefix="/api",
)
app.include_router(
    collectors_router,
    prefix="/api",
)
app.include_router(
    contact_attempts_router,
    prefix="/api",
)
app.include_router(
    payment_reconciliation_router,
    prefix="/api",
)
app.include_router(
    financial_router,
    prefix="/api",
)
app.include_router(
    cases_router,
    prefix="/api",
)
app.include_router(
    case_timeline_router,
    prefix="/api",
)
app.include_router(
    promises_router,
    prefix="/api",
)
app.include_router(
    promise_monitoring_router,
    prefix="/api",
)
app.include_router(
    payments_router,
    prefix="/api",
)
app.include_router(
    payment_imports_router,
    prefix="/api",
)
app.include_router(
    imports_router,
    prefix="/api",
)
app.include_router(
    popia_router,
    prefix="/api",
)
app.include_router(
    billing_router,
    prefix="/api",
)
app.include_router(
    router,
    prefix="/api",
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "collections-api",
    }