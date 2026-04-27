import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from sqlmodel import Session, text
from database import engine

def migrate():
    with Session(engine) as session:
        try:
            # Check if columns exist
            session.exec(text("ALTER TABLE resume ADD COLUMN extracted_skills TEXT DEFAULT '[]';"))
            session.exec(text("ALTER TABLE resume ADD COLUMN experience_years INTEGER DEFAULT 0;"))
            session.commit()
            print("Successfully migrated resume table.")
        except Exception as e:
            print(f"Migration error (might already exist): {e}")

if __name__ == "__main__":
    migrate()
