# CollectionsOS MVP

A multi-tenant SaaS MVP for municipal debt collection.

## MVP scope
- Municipality/tenant setup
- CSV/XLSX debt-book ingestion
- Import validation and field mapping foundation
- Customer, property, municipal account and debt records
- Collection cases and workflow states
- Configurable collection rules
- Promises to pay
- Payment arrangements
- Payment imports/reconciliation foundation
- Agent work queue
- Municipality recovery dashboard
- Full audit/event foundation

## Recommended stack
- Frontend: React + Vite + TypeScript
- Backend: FastAPI + SQLAlchemy
- Database: PostgreSQL
- Background jobs: Redis + Celery (Phase 2)
- Authentication: JWT initially; replace with managed IdP for production
- File storage: S3-compatible storage
- Messaging: WhatsApp/SMS provider adapters

## Quick start
1. Copy `.env.example` to `.env`.
2. Run `docker compose up --build`.
3. API: http://localhost:8000/docs
4. Frontend: http://localhost:5173

This repository is intentionally a clean MVP foundation. Production deployment must add legal/compliance review, strong authentication, encryption/key management, provider integrations, backups, monitoring and security testing.
