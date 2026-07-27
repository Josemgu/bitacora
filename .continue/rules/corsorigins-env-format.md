---
globs: '["**/.env*", "app/config.py"]'
description: Apply when editing .env or Settings config related to CORS_ORIGINS
alwaysApply: false
---

The CORS_ORIGINS field in .env must use JSON array format (e.g., CORS_ORIGINS=["http://localhost:3000"]) because pydantic-settings tries to JSON-decode complex types. A field_validator was also added in app/config.py as a fallback for comma-separated values.