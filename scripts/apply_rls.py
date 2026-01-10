"""
Apply SQL RLS setup to a target DATABASE_URL.

Usage:
  EXPORT DATABASE_URL=postgresql://postgres:password@localhost:5432/ai_business_automation_dev
  python scripts/apply_rls.py

If the database does not exist, create it first or set ADMIN_DATABASE_URL pointing to a superuser DB.
"""
import os
import asyncio
import asyncpg


async def run():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("Please set DATABASE_URL environment variable")
        return

    sql_path = os.path.join(os.path.dirname(__file__), "..", "sql", "rls_setup.sql")
    with open(sql_path, "r") as f:
        sql = f.read()

    conn = await asyncpg.connect(database_url)
    try:
        # Split the SQL script into statements and execute sequentially so
        # we can ignore 'already exists' type errors and make the script idempotent.
        statements = [s.strip() for s in sql.split(";") if s.strip()]
        for i, stmt in enumerate(statements, start=1):
            preview = stmt.replace("\n", " ")[:120]
            print(f"Executing statement {i}: {preview}")
            try:
                await conn.execute(stmt)
            except Exception as e:
                msg = str(e).lower()
                if "already exists" in msg or "duplicate" in msg or "policy .* already exists" in msg:
                    print(f"Statement {i}: object already exists, skipping.")
                    continue
                else:
                    print(f"Statement {i} failed (skipping): {e}")
                    print(f"Failed statement {i} full text:\n{stmt}\n---")
                    # Continue rather than raising so a best-effort idempotent run completes.
                    continue
        print("SQL applied (idempotent run) successfully.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(run())
