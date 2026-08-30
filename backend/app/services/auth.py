import hashlib
import os
import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models import User, Tenant


def hash_password(password: str) -> str:
    """
    Standard PBKDF2-HMAC-SHA256 password hashing.
    """
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return f"{salt.hex()}:{key.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        salt_hex, key_hex = hashed_password.split(":")
        salt = bytes.fromhex(salt_hex)
        key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, 100000)
        return key.hex() == key_hex
    except Exception:
        return False


def seed_default_users(db: Session):
    """
    Seeds SuperAdmin and Admin logins if not present.
    """
    demo_tenant = db.execute(select(Tenant)).scalars().first()
    demo_tenant_id = demo_tenant.id if demo_tenant else None

    # 1. SuperAdmin (Global oversight)
    superadmin_email = "superadmin@collectionsos.gov.za"
    superadmin = db.execute(
        select(User).where(User.email == superadmin_email)
    ).scalar_one_or_none()

    if not superadmin:
        superadmin = User(
            id=uuid.uuid4(),
            tenant_id=None,
            email=superadmin_email,
            hashed_password=hash_password("SuperAdmin@2026!"),
            full_name="Executive SuperAdmin",
            role="SUPERADMIN",
            is_active=True,
            created_at=datetime.now(timezone.utc),
        )
        db.add(superadmin)

    # 2. Municipality Admin (Tenant operations)
    admin_email = "admin@collectionsos.gov.za"
    admin = db.execute(
        select(User).where(User.email == admin_email)
    ).scalar_one_or_none()

    if not admin:
        admin = User(
            id=uuid.uuid4(),
            tenant_id=demo_tenant_id,
            email=admin_email,
            hashed_password=hash_password("Admin@2026!"),
            full_name="Municipal Collections Admin",
            role="ADMIN",
            is_active=True,
            created_at=datetime.now(timezone.utc),
        )
        db.add(admin)

    # 3. Debt Collector (Work Queue & Debtor Engagement)
    collector_email = "collector@collectionsos.gov.za"
    collector = db.execute(
        select(User).where(User.email == collector_email)
    ).scalar_one_or_none()

    if not collector:
        collector = User(
            id=uuid.uuid4(),
            tenant_id=demo_tenant_id,
            email=collector_email,
            hashed_password=hash_password("Collector@2026!"),
            full_name="Senior Debt Collector",
            role="COLLECTOR",
            is_active=True,
            created_at=datetime.now(timezone.utc),
        )
        db.add(collector)

    # 4. Compliance Auditor (Read-Only Financial Logs)
    auditor_email = "auditor@collectionsos.gov.za"
    auditor = db.execute(
        select(User).where(User.email == auditor_email)
    ).scalar_one_or_none()

    if not auditor:
        auditor = User(
            id=uuid.uuid4(),
            tenant_id=demo_tenant_id,
            email=auditor_email,
            hashed_password=hash_password("Auditor@2026!"),
            full_name="Internal Compliance Auditor",
            role="AUDITOR",
            is_active=True,
            created_at=datetime.now(timezone.utc),
        )
        db.add(auditor)

    db.commit()
