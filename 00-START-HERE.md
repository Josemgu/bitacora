# Bitácora — Estado actual y handoff para la siguiente IA

> Lee este archivo primero antes de tocar código. Resume qué se hizo en Bloque A y Bloque B, qué parte de seguridad ya quedó verificada, y qué pruebas ya demostraron que lo actual funciona.

## Estado general

Bitácora tiene Bloque A y Bloque B completos y verificados.
- Bloque A funcional en su frente principal de proveedores y configuración.
- Bloque B implementing B1–B6 completado y verificado con pruebas.
- La aplicación levanta localmente y responde en `http://127.0.0.1:8000`.
- El README ya fue actualizado para GitHub y deja claro que el proyecto sigue en desarrollo.

## Qué se completó del Bloque A

### A1 y A1b: manejo de proveedores y credenciales

Se dejó implementada la base del flujo de proveedores, adaptada al stack real del repo.

Hecho:
- modo dual `selfhost` y `hosted` en configuración del backend
- cifrado de credenciales del lado del navegador
- integración de configuración de proveedores en la SPA
- integración del chat con conciencia del origen del proveedor
- flujo oficial de OpenRouter con PKCE
- callback local de OpenRouter
- rechazo de flujos OAuth prohibidos fuera de OpenRouter
- validación de origen del callback de OpenRouter
- advertencia de gasto para OpenRouter en la interfaz

Archivos clave ya alineados:
- `app/config.py`
- `app/security.py`
- `app/routers/providers.py`
- `static/js/config.js`
- `static/js/ai-chat.js`
- `static/js/encryption.js`
- `static/js/provider-connection.js`
- `static/callback/openrouter.html`

## Qué se completó del Bloque B

### B1 — CI/CD de seguridad
- Workflow `.github/workflows/security.yml` con Gitleaks y Trivy.
- `.gitleaks.toml` con reglas personalizadas.
- `SECURITY.md` con política de reporte.

### B2 — Saneamiento de entrada
- `backend/security/inputs.py`: `sanitize_rich_text()` con allowlist estricta (Bleach).
- `backend/security/inputs.py`: `secure_image_upload()` valida magic bytes y limpia EXIF.

### B3 — Rate limiting
- `backend/security/rate_limit.py`: limiter con SlowAPI (60/min estándar, 5/min IA).
- Integrado en `app/main.py` con `SlowAPIMiddleware`.
- Aplicado a todos los routers: chat, providers, resources, mailbox, profile, health.
- `tests/test_rate_limit_integration.py` valida 429 en la app real.

### B4 — Cifrado en reposo
- `app/security.py`: `encrypt_api_key()` / `decrypt_api_key()` con Fernet.
- `backend/security/encryption.py`: `encrypt_secret()` / `decrypt_secret()`.
- `app/routers/providers.py` cifra API keys en modo hosted.

### B5 — Cabeceras de seguridad
- Middleware en `app/main.py`: HSTS, X-Content-Type-Options, X-Frame-Options.

### B6 — Guardián IA + DB
- `backend/security/ai_guard.py`: `validate_ai_output()` enmascara secretos y SQL.
- `backend/security/ai_budget.py`: `AIBudgetGuard` controla presupuesto de tokens.

## Qué quedó probado y funcionando

Estas comprobaciones ya se ejecutaron con resultado correcto durante esta fase:

### Backend

Comando:


