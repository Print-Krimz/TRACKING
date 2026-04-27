"""One-time migration: Add 'DEPLOYED' (uppercase) to applicationstatus PostgreSQL enum."""
from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    # The DB stores enum names in UPPERCASE, so add DEPLOYED
    conn.execute(text("ALTER TYPE applicationstatus ADD VALUE IF NOT EXISTS 'DEPLOYED'"))
    conn.commit()
    
    # Verify
    result = conn.execute(text("SELECT unnest(enum_range(NULL::applicationstatus))"))
    values = [row[0] for row in result]
    print("applicationstatus enum values:", values)
    
    if "DEPLOYED" in values:
        print("SUCCESS: 'DEPLOYED' is now in the enum")
    else:
        print("FAILED: 'DEPLOYED' was not added")
