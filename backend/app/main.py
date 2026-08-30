from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import settings
from app.db.session import Base

# Import models so SQLAlchemy knows about them
from app.models import (
    Tenant,
    Customer,
    Property,
    MunicipalAccount,
    CollectionCase,
    Promise,
    PaymentPlan,
    Payment,
    AuditEvent,
)



app = FastAPI(
    title="CollectionsOS API",
    version="0.1.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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