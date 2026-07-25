# Database Privileges (Minimum Privilege Policy)

This project should run production traffic using a database role with minimum privileges.

## Runtime App Role

- Allowed: `SELECT`, `INSERT`, `UPDATE`, `DELETE` on application tables only.
- Forbidden: all DDL privileges (`CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `CREATE EXTENSION`).
- Forbidden: ownership transfer, role management, and writes to system catalogs.

## Migration Role (Deployment Only)

- Used only by migration tooling during deploy windows.
- Can perform required DDL for schema migrations.
- Must not be used by runtime API processes.

## Operational Guidance

- Use separate credentials for runtime and migrations.
- Rotate credentials periodically and after incidents.
- Audit grants with SQL review before each production release.
- Keep least privilege enforced at database level, not only in app code.
