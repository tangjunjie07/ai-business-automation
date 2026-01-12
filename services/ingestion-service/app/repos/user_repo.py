from typing import Any


async def exists_under_tenant(conn: Any, user_id: str, tenant_id: str) -> bool:
    """Return True if user exists and belongs to tenant."""
    try:
        # Column name in DB (Prisma schema) is `tenantId` for the User model
        row = await conn.fetchrow('SELECT id FROM "User" WHERE id = $1 AND "tenantId" = $2', user_id, tenant_id)
        return bool(row)
    except Exception:
        return False
