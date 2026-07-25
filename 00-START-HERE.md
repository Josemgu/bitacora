# Bitácora — Estado actual y handoff para la siguiente IA

> Lee este archivo primero antes de tocar código. Resume qué se hizo en Bloque A, qué parte de seguridad ya quedó verificada, qué sigue en Bloque B y qué pruebas ya demostraron que lo actual funciona.

## Estado general

Bitácora está en una transición entre cierre de Bloque A y arranque de Bloque B.

- Bloque A funcional en su frente principal de proveedores y configuración.
- Bloque B todavía no ha empezado a implementarse; sí tiene plan de ejecución listo.
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

## Qué quedó probado y funcionando

Estas comprobaciones ya se ejecutaron con resultado correcto durante esta fase:

### Backend

Comando:

```bash
python -m pytest -q
```

Resultado verificado más reciente:
- `1 passed`

Cobertura actual relevante:
- existencia de rutas de perfil y configuración

Archivo de prueba actual:
- `tests/test_profile_config_routes.py`

### Frontend / flujo de proveedores

Comando:

```bash
node tests/test_provider_connection_flow.js
```

Resultado verificado más reciente:
- `4 passed`
- `0 failed`

Cobertura actual relevante:
- generación correcta de challenge PKCE
- normalización de origen de proveedor
- rechazo de OAuth no permitido fuera de OpenRouter
- rechazo de callback con origen inesperado

Archivo de prueba actual:
- `tests/test_provider_connection_flow.js`

## Qué funciona hoy

A día de hoy, se puede afirmar con evidencia reciente que funciona esto:

- la app sirve frontend y backend localmente
- el endpoint de salud responde correctamente
- el panel de configuración muestra la conexión de proveedores
- el flujo aprobado de OpenRouter está cableado
- el callback de OpenRouter valida origen antes de aceptar el código
- el helper de proveedores pasa sus regresiones actuales

## Qué NO está implementado todavía

Esto sigue pendiente y no debe presentarse como terminado:

- B1: workflow de seguridad con Gitleaks y Trivy
- B2: sanitización de HTML externo y validación de imágenes
- B3: rate limiting por endpoint
- B4: prueba dedicada de secretos en reposo en modo hosted
- B5: middleware de HTTPS para producción
- B6: blindaje adicional de la base de datos ante salida de IA

## Documento que define el siguiente trabajo

El plan ejecutable para empezar Bloque B ya existe aquí:

- `docs/superpowers/plans/2026-07-25-block-b-security.md`

Ese plan ya adapta el bloque al layout real del repo:
- `app/` para backend
- `static/` para frontend
- `tests/` en raíz

## Orden obligatorio al continuar

La siguiente IA debe seguir este orden y no saltarlo:

1. B1 — escaneo automático en CI
2. B2 — blindar HTML externo e imágenes
3. B3 — rate limiting
4. B4 — cifrado en reposo para hosted
5. B5 — HTTPS/TLS para producción
6. solo después: evaluar B6

## Restricciones importantes para la siguiente IA

- No crear un paquete `app/security/` porque ya existe `app/security.py` como módulo activo.
- No rehacer la arquitectura.
- No vender Bloque B como implementado: solo está planificado.
- Mantener la separación entre `selfhost` y `hosted`.
- No introducir OAuth para Claude, ChatGPT o proveedores no aprobados.
- Mantener OpenRouter como único flujo OAuth permitido.

## Documentación actualizada en esta fase

Ya se actualizó:
- `README.md`
- `.env.example`
- imágenes de documentación en `docs/images/`
- este documento de handoff

## Punto de arranque recomendado para la próxima sesión

Antes de editar código:

1. leer este archivo completo
2. leer `docs/superpowers/plans/2026-07-25-block-b-security.md`
3. arrancar por B1 y validar dependencias antes de instalar nada
4. no empezar B2-B6 hasta cerrar B1

## Resumen corto

Bloque A quedó suficientemente estable para seguir.
Bloque B aún no está construido.
Lo ya implementado en proveedores, callback y validación básica sí está probado.
La próxima IA debe entrar por B1 usando el plan ya guardado.
