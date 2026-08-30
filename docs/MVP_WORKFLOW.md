# CollectionsOS MVP Workflow

## Canonical case lifecycle

NEW
→ VALIDATED
→ CONTACT_ATTEMPTED
→ ENGAGED
→ PROMISE_TO_PAY
→ PAYMENT_ARRANGEMENT
→ PAYING
→ PAID
→ CLOSED

Exception states:
- DISPUTED: pause collection actions pending review.
- BROKEN_PROMISE: payment commitment failed.
- ESCALATED: moved to a higher collection/review stage.

## Initial strategy rules

1. 0–30 days arrears: early intervention.
2. 31–90 days: standard digital collection.
3. 91–180 days: intensive collection.
4. >180 days: escalation review.
5. High-value accounts: priority agent handling.
6. Disputed accounts: do not continue automated collection until the dispute workflow permits it.
7. Indigent/exempt accounts: route to municipality-specific policy workflow.

These are product defaults only. A municipality's approved policy and applicable law must control actual collection behaviour.

## MVP event model

Important events:
- DEBT_BOOK_IMPORTED
- ACCOUNT_VALIDATED
- CONTACT_SENT
- CONTACT_DELIVERED
- CUSTOMER_RESPONDED
- PROMISE_CREATED
- PROMISE_PAID
- PROMISE_BROKEN
- PAYMENT_PLAN_CREATED
- INSTALLMENT_DUE
- INSTALLMENT_PAID
- PAYMENT_RECEIVED
- PAYMENT_RECONCILED
- DISPUTE_OPENED
- CASE_ESCALATED
- CASE_CLOSED

## Definition of done for MVP

A user can:
1. Create a municipality tenant.
2. Upload a debt book.
3. Preview and validate the data.
4. Map source columns to canonical fields.
5. Create accounts/customers/properties.
6. Generate collection cases.
7. Segment cases using rules.
8. Assign cases to agents.
9. Record contact attempts.
10. Create promises/payment plans.
11. Import and reconcile payments.
12. View recovery performance.
13. Audit every material action.
