import uuid
from typing import Optional


async def resolve_by_id_or_code(conn, identifier: str) -> Optional[str]:
    """Resolve tenant identifier: accept UUID, code, or id::text.

    Returns tenant id string or None if not found.
    """
    if not identifier:
        return None

    # Accept raw UUIDs
    try:
        uuid.UUID(identifier)
        return identifier
    except Exception:
        pass

    # Query quoted table name used in DB (schema may use "Tenant")
    try:
        row = await conn.fetchrow('SELECT id FROM "Tenant" WHERE code = $1 OR id::text = $1', identifier)
        if row:
            return str(row["id"])
    except Exception:
        # swallow and return None to allow caller to handle
        return None

    return None
