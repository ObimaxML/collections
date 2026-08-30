# Core Data Model

Tenant
- Municipality/customer organisation.

Customer
- Debtor identity/contact record.

Property
- Municipal property record.

MunicipalAccount
- Billing account tied to customer/property.

CollectionCase
- Operational collection unit. This is the central workflow object.

Promise
- Promise-to-pay commitment.

PaymentPlan
- Structured repayment agreement.

Payment
- Financial transaction received from municipality/bank/payment provider.

AuditEvent
- Immutable operational/compliance trail.

Future entities:
- ImportJob
- ImportMapping
- Communication
- CommunicationTemplate
- CollectionRule
- CollectionStrategy
- Task
- Dispute
- Document
- Agent
- User
- Role
- Permission
- SettlementOffer
- LegalReferral
- FieldVisit
