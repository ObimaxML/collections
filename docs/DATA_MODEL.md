# Core Data Model & Platform Architecture

## Platform Operating Philosophy
Khokhisa is a pure technology and cloud software platform provider. Khokhisa:
1. **Never holds debtor funds** — all payments settle directly into collector statutory trust accounts or municipal/corporate primary revenue bank accounts.
2. **Invoices purely for Platform Usage & SaaS Software Licenses** — Khokhisa does not charge or retain collection commission.
3. **Automates Individual Collector Commission Calculations** — helps registered individual debt collectors track and calculate their prescribed commission based on what they have collected.
4. **Enforces Statutory Trust Accounts & CFDC Registration** — collectors collecting on behalf of any entity must have a valid Council for Debt Collectors (CFDC) registration and a verified statutory separate trust account with annual audit reports.
5. **Universal Entity Onboarding** — municipalities, state-owned enterprises, corporations, and credit providers can register and use the platform internally with internal staff or external panel collectors.

---

## Core Entities

### Tenant / Client Organization
- Municipality, corporate entity, or credit provider using the platform internally or deploying external collection panels.
- Profile includes bank details (bank name, branch code, account number, payment reference format).
- **Billing Model**: Invoiced strictly for monthly cloud SaaS access and high-volume data usage.

### User & CollectorProfile
- Multi-role users (`SUPERADMIN`, `ADMIN`, `COLLECTOR`, `AUDITOR`).
- `COLLECTOR` profiles are linked to:
  - CFDC Registration Number and certificate expiry date.
  - Verification & compliance status (`VERIFIED`, `PENDING`, `SUSPENDED`).
  - Many-to-many municipal/corporate assignments.

### CollectorTrustAccount (1-to-1 with CollectorProfile)
- Mandatory separate statutory bank account under Section 20 of the Debt Collectors Act 114 of 1998.
- Bank name, branch code, account number, account holder name.
- Uploads: Bank Confirmation Letter, Auditor Letter, Last Annual Audit Report.
- Annual trust audit due date with automated warning engine.

### CollectorRemittance
- Dual-entry ledger recording gross cash collected in collector trust account.
- Automatically calculates:
  - Collector contingency commission earned.
  - Net municipal / entity remittance amount.
- Reconciled against municipal bank statements.

### Customer / Debtor
- Debtor identity, contact details, ID number, and arrears balance.

### CollectionCase & MunicipalAccount
- Operational collection workflow unit.
- Tracks debt strategies, contact history, and promises to pay.

### AuditEvent (POPIA Section 19)
- Immutable operational and compliance audit trail of all PII views, edits, exports, assignments, and remittances.
