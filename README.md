# 🏛️ CollectionsOS — Municipal Debt Collection SaaS Platform MVP

A multi-tenant SaaS application purpose-built for South African municipal debt collection, revenue recovery, collector workload management, promise-to-pay tracking, and auditable financial transaction ledger accounting.

---

## 🚀 Quick Start & Development Environment

1. **Environment Setup**:
   ```bash
   cp .env.example .env
   ```
2. **Launch Services**:
   ```bash
   docker compose up -d --build
   ```
3. **Service Access**:
   - **Interactive API Documentation (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Web Application Dashboard (Frontend)**: [http://localhost:5173](http://localhost:5173)
   - **PostgreSQL Database Container**: `collections_os_mvp-db-1` (`port 5432`)

---

## 📐 Architecture & Technology Stack

| Layer | Technology | Key Details |
| :--- | :--- | :--- |
| **Frontend** | React 18 + Vite + TypeScript | SPA, Responsive Tailwind & Glassmorphism Design System, Lucide Icons |
| **Backend** | Python 3.12 + FastAPI | Async REST API, Pydantic v2 validation schemas, Modular Router architecture |
| **Database** | PostgreSQL 16 + SQLAlchemy 2.0 | Multi-tenant relational data model, Alembic schema migration management |
| **Ledger Engine**| Double-Entry Inspired Financial Ledger | Formula: `Balance = SUM(OPENING_BALANCE + CHARGE + DEBIT + ADJUSTMENT_DEBIT) - SUM(PAYMENT + CREDIT + ADJUSTMENT_CREDIT)` |
| **Auditing** | Immutable Audit Log (`audit_events`) | Captures actor, event type, entity ID, and JSON payload for every action |
| **Containerization**| Docker Compose | Multi-container setup (`db`, `backend`, `frontend`) with automatic healthchecks |

---

### 💼 Dual Engagement & Business Operating Models (Molmos)

CollectionsOS is architected to support two distinct commercial and operating delivery models:

1. **🛡️ Molmos Managed Service (Outsourced Agency Debt Recovery)**:
   - The municipality retains **Molmos** as an external recovery agency.
   - Molmos deploy their own professional collector teams onto the municipal portfolio.
   - **Commercial Structure**: Success-based commission (e.g. `10.00%` of all reconciled recovered debt).
   - Municipal executives and CFOs retain read-only supervisory dashboards, financial oversight, and real-time audit trail visibility.

2. **💻 Municipal SaaS Subscription (Internal Municipal Collection)**:
   - The municipality licenses CollectionsOS as a multi-tenant cloud SaaS platform to run their own internal debt recovery division.
   - Municipal collectors, team leads, and admins use the workbench, work queues, PTP tracking, and column ingestion engine directly.
   - **Commercial Structure**: Fixed monthly subscription licensing fee based on tier (`STARTER`, `PROFESSIONAL`, `ENTERPRISE`).

---

## 🔄 Step-by-Step System Workflows & Processes

### Workflow 1: Multi-Tenant Onboarding & Municipal Account Ingestion
1. **Tenant Provisioning**: Each municipality (e.g. City of Johannesburg) is onboarded with:
   - **Engagement Model**: `MANAGED_SERVICE` (Molmos Managed) or `SAAS_SELF_SERVICE` (Internal SaaS).
   - **Subscription Tier**: `STARTER`, `PROFESSIONAL`, `ENTERPRISE`.
   - **Commercial Terms**: Configurable commission rate (%) or monthly SaaS license fee (ZAR).
2. **Account Ingestion**: Accounts are onboarded with property details, customer demographics, current account balance, and DPD (Days Past Due) aging metrics.
3. **Opening Balance Backfill**: Generates `OPENING_BALANCE` entries in `financial_transactions` (`abs(balance)`) for every account onboarded to establish an auditable opening balance baseline without inventing fake transaction history.

---

### Workflow 2: Collector Work Queue & Case Prioritization Engine
1. **Priority Score Calculation (0 - 100)**:
   - **Arrears Thresholds**: $\ge \text{R}100k$ (+40 pts), $\ge \text{R}50k$ (+30 pts), $\ge \text{R}20k$ (+20 pts), $\ge \text{R}5k$ (+10 pts).
   - **Aging (DPD)**: $> 120$ days (+30 pts), $> 90$ days (+20 pts), $> 60$ days (+10 pts).
   - **Status Risk Penalties**: `BROKEN_PROMISE` (+20 pts), `NEW` (+10 pts).
2. **Workload Distribution**: Cases sorted by priority score DESC (`GET /api/work-queue/my-queue`). Managers assign case ownership (`POST /api/cases/{case_id}/assign`).

---

### Workflow 3: Case Lifecycle & Activity Logging
1. **Collector Contact Attempt**:
   - Collector records contact (Phone Call, SMS, WhatsApp, Email, Field Visit) via `POST /api/cases/{case_id}/contact-attempts`.
2. **Automatic State Machine Progression**:
   - `NEW` $\rightarrow$ `CONTACT_ATTEMPTED` (First contact attempt).
   - `CONTACT_ATTEMPTED` $\rightarrow$ `ENGAGED` (Successful contact confirmed).

---

### Workflow 4: Promise-to-Pay (PTP) & Payment Arrangements
1. **Promise Creation**: Collector records customer commitment date & amount (`POST /api/cases/{case_id}/promises`). Case transitions to `PROMISE_TO_PAY`.
2. **Payment Arrangements**: Structured deposit and installment agreement created (`POST /api/payment-plans`). Case transitions to `ARRANGEMENT`.

---

### Workflow 5: Payment Recording, Automatic Promise Reconciliation & Ledger Posting
1. **Payment Capture**: Logged via `POST /api/payments` (`reconciliation_status="PENDING"`).
2. **Reconciliation Execution (`POST /api/payments/{payment_id}/reconcile`)**:
   - Evaluates pending promises on the account.
   - **Full Payment ($\ge$ Promise Amount)**: Promise marked `KEPT`; case status transitions to `PAYING`.
   - **Partial Payment ($<$ Promise Amount)**: Flagged as `PARTIAL_PAYMENT`.
3. **Atomic Financial Ledger Posting**:
   - Creates a `PAYMENT` entry in `financial_transactions` (`source_type="Payment"`, `source_id=payment_id`).
   - **Database Idempotency**: Guarded by unique constraint `uq_financial_transactions_source` on `(source_type, source_id)`. Re-executing reconciliation returns `ALREADY_RECONCILED` without duplicating entries.
4. **Audit Trail**: Emits `PAYMENT_RECONCILED` audit event with `ledger_transaction_id`.

---

### Workflow 6: Financial Account Balance Reconciliation & Discrepancy Engine
1. **Formula**:
   $$\text{Ledger Balance} = \sum (\text{OPENING\_BALANCE} + \text{CHARGE} + \text{DEBIT} + \text{ADJUSTMENT\_DEBIT}) - \sum (\text{PAYMENT} + \text{CREDIT} + \text{ADJUSTMENT\_CREDIT})$$
2. **Classification** (`GET /api/ledger/reconciliation/summary`):
   - **`NO_LEDGER`**: Account missing opening position (`opening_balance_exists = False`).
   - **`MATCH`**: $|\text{Ledger Balance} - \text{Stored Account Balance}| \le \text{R}0.01$ (R0.01 tolerance).
   - **`MISMATCH`**: Discrepancy detected (e.g. reconciled payments captured in ledger while legacy stored balance remains unadjusted).
3. **Prioritization**: Portfolio reconciliation returns discrepancy items sorted by $|\text{difference}|$ DESC to populate financial exception queues.

---

### Workflow 7: Charge & Adjustment Import Framework
1. **Supported Transaction Types**: `CHARGE` (+), `DEBIT` (+), `ADJUSTMENT_DEBIT` (+), `PAYMENT` (-), `CREDIT` (-), `ADJUSTMENT_CREDIT` (-).
2. **Single Transaction Import (`POST /api/ledger/transactions/import`)**:
   - Validates `MunicipalAccount` belongs to `tenant_id`.
   - Checks `(tenant_id, source_type, source_id)` for duplicate prevention.
   - Posts ledger entry and emits `LEDGER_TRANSACTION_IMPORTED` audit event.

---

### Workflow 8: Batch Import & Staging Pipeline (CSV/Excel/API)
1. **Stage 1: Batch Creation (`POST /api/imports/batches`)**: Raw rows staged into `import_rows` (`status="PENDING"`). Batch created (`status="VALIDATING"`).
2. **Stage 2: Batch Validation (`POST /api/imports/batches/{batch_id}/validate`)**: Validates account numbers, transaction types, dates, positive amounts, and source IDs. Invalid rows set batch to `VALIDATION_ERRORS`.
3. **Stage 3: Batch Import Execution (`POST /api/imports/batches/{batch_id}/import`)**: Blocks import if status is not `VALIDATED`. Resolves `account_number` to `MunicipalAccount.id`, invokes `import_ledger_transaction`, links `import_rows.financial_transaction_id` to `FinancialTransaction`, and marks batch `COMPLETED`.

---

## 📊 Comprehensive API Endpoint Index

### 1. Dashboard & Financial Metrics
- `GET /api/dashboard/summary`: High-level portfolio metrics (Debt Book, Recovered, Outstanding, Active Cases).
- `GET /api/financial/portfolio`: Live PostgreSQL aggregate debt book, recovery totals, and collection rates.
- `GET /api/financial/accounts/{account_id}`: Account-specific financial overview and payments summary.

### 2. Cases & Collector Work Queue
- `GET /api/work-queue`: Prioritized queue of collection cases across all accounts.
- `GET /api/work-queue/my-queue`: Collector-specific prioritized workload.
- `GET /api/cases/{case_id}`: 360-degree case overview (Account, Customer, Property, Activities, Contact Attempts, Promises).
- `POST /api/cases/{case_id}/transition`: State machine transition (`NEW`, `CONTACT_ATTEMPTED`, `ENGAGED`, `PROMISE_TO_PAY`, `ARRANGEMENT`, `PAYING`, `PAID`, `BROKEN_PROMISE`, `CLOSED`).
- `POST /api/cases/{case_id}/assign`: Assign/reassign collector ownership to a case.

### 3. Collector Activities & Contact Attempts
- `POST /api/cases/{case_id}/contact-attempts`: Record contact attempt (Call, SMS, WhatsApp, Email, Field Visit) and result.
- `GET /api/cases/{case_id}/contact-attempts`: History of contact attempts for a case.

### 4. Promises to Pay & Payment Arrangements
- `POST /api/cases/{case_id}/promises`: Record new promise-to-pay.
- `GET /api/promises/pending`: Query all pending promises due for monitoring.
- `POST /api/payment-plans`: Create structured installment agreement.

### 5. Payments & Reconciliation
- `POST /api/payments`: Record incoming payment (PENDING).
- `POST /api/payments/{payment_id}/reconcile`: Reconcile payment against pending promises and post to financial ledger.

### 6. Financial Ledger & Reconciliation Engine
- `GET /api/ledger/accounts/{account_id}/summary`: Account ledger balance summary.
- `GET /api/ledger/accounts/{account_id}`: List all ledger transactions for an account.
- `POST /api/ledger/accounts/{account_id}/transactions`: Manual ledger transaction entry.
- `GET /api/ledger/accounts/{account_id}/reconciliation`: Single account balance reconciliation status.
- `GET /api/ledger/reconciliation/summary`: Portfolio-wide balance reconciliation report and exception list.
- `POST /api/ledger/backfill/reconciled-payments`: Backfill historical reconciled payments into ledger.
- `POST /api/ledger/backfill/opening-balances`: Backfill opening balances for onboarded municipal accounts.
- `POST /api/ledger/transactions/import`: Import single charge/adjustment transaction.

### 7. Batch Staging & Import Pipeline
- `POST /api/imports/batches`: Create and stage raw import batch.
- `POST /api/imports/batches/{batch_id}/validate`: Validate staged batch rows.
- `POST /api/imports/batches/{batch_id}/import`: Post validated batch rows into financial ledger.

---

## 🔒 Security, Multi-Tenancy & Integrity Safeguards

1. **Multi-Tenant Isolation**: Every database table includes `tenant_id`. All query services enforce `tenant_id` filters to prevent cross-tenant data leakage.
2. **Database Idempotency**: Unique constraint `uq_financial_transactions_source` on `(source_type, source_id)` and index `ix_import_rows_batch_row` prevent double-posting of financial data.
3. **Atomic Database Transactions**: Payment reconciliation, promise evaluation, ledger transaction posting, and audit logging execute within a single SQLAlchemy `db.commit()` block.
4. **Auditability**: Every mutation writes a non-editable record to `audit_events` with standard ISO timestamps and contextual JSON payloads.
