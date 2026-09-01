import uuid
from sqlalchemy import text
from app.db.session import SessionLocal

db = SessionLocal()

res = db.execute(text("SELECT id, name, code FROM tenants WHERE name ILIKE '%Phalaborwa%' OR code ILIKE '%BAP%'")).fetchall()

if not res:
    print("No tenant matching 'Ba-Phalaborwa' found.")
else:
    for row in res:
        tenant_id = str(row[0])
        print(f"Purging all tables for tenant {row[1]} ({row[2]}) [ID: {tenant_id}]...")

        statements = [
            f"DELETE FROM municipal_contract_mandates WHERE tenant_id = '{tenant_id}'",
            f"DELETE FROM data_breach_incidents WHERE tenant_id = '{tenant_id}'",
            f"DELETE FROM collector_remittances WHERE tenant_id = '{tenant_id}'",
            f"DELETE FROM collector_municipal_assignments WHERE tenant_id = '{tenant_id}'",
            f"DELETE FROM data_processing_agreements WHERE tenant_id = '{tenant_id}'",
            f"DELETE FROM payment_allocations WHERE payment_id IN (SELECT id FROM payments WHERE tenant_id = '{tenant_id}')",
            f"DELETE FROM payment_allocations WHERE promise_id IN (SELECT id FROM promises WHERE case_id IN (SELECT id FROM collection_cases WHERE tenant_id = '{tenant_id}'))",
            f"DELETE FROM collection_activities WHERE case_id IN (SELECT id FROM collection_cases WHERE tenant_id = '{tenant_id}')",
            f"DELETE FROM case_activities WHERE case_id IN (SELECT id FROM collection_cases WHERE tenant_id = '{tenant_id}')",
            f"DELETE FROM contact_attempts WHERE case_id IN (SELECT id FROM collection_cases WHERE tenant_id = '{tenant_id}')",
            f"DELETE FROM promises WHERE case_id IN (SELECT id FROM collection_cases WHERE tenant_id = '{tenant_id}')",
            f"DELETE FROM payment_plans WHERE case_id IN (SELECT id FROM collection_cases WHERE tenant_id = '{tenant_id}')",
            f"DELETE FROM import_rows WHERE batch_id IN (SELECT id FROM import_batches WHERE tenant_id = '{tenant_id}')",
            f"DELETE FROM import_batches WHERE tenant_id = '{tenant_id}'",
            f"DELETE FROM payments WHERE tenant_id = '{tenant_id}'",
            f"DELETE FROM collection_cases WHERE tenant_id = '{tenant_id}'",
            f"DELETE FROM municipal_accounts WHERE tenant_id = '{tenant_id}'",
            f"DELETE FROM customers WHERE tenant_id = '{tenant_id}'",
            f"DELETE FROM properties WHERE tenant_id = '{tenant_id}'",
            f"DELETE FROM proposals WHERE tenant_id = '{tenant_id}'",
            f"DELETE FROM invoices WHERE tenant_id = '{tenant_id}'",
            f"DELETE FROM audit_events WHERE tenant_id = '{tenant_id}'",
            f"DELETE FROM user_tenants WHERE tenant_id = '{tenant_id}'",
            f"UPDATE users SET tenant_id = NULL WHERE tenant_id = '{tenant_id}'",
            f"DELETE FROM tenants WHERE id = '{tenant_id}'"
        ]

        for stmt in statements:
            try:
                db.execute(text(stmt))
                db.commit()
            except Exception as e:
                db.rollback()
                print(f"Error on statement [{stmt}]: {e}")

        print(f"✅ Successfully completed purge for {row[1]}!")

remaining = db.execute(text("SELECT id, name, code FROM tenants")).fetchall()
print(f"Remaining tenants in DB: {len(remaining)}")
for r in remaining:
    print(f"- {r[1]} ({r[2]}) [ID: {r[0]}]")
