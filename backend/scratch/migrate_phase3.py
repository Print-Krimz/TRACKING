import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from sqlmodel import Session, text
from database import engine

def migrate():
    with Session(engine) as session:
        try:
            # Add enum value
            session.exec(text("ALTER TYPE applicationstatus ADD VALUE IF NOT EXISTS 'deployed';"))
            session.commit()
            print("Successfully migrated applicationstatus enum.")
        except Exception as e:
            print(f"Migration error (might already exist): {e}")

if __name__ == "__main__":
    migrate()
