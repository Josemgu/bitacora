# Bitacora - Estado real del proyecto

## Reglas obligatorias antes de tocar codigo

1. Este archivo es la UNICA fuente de verdad sobre que esta realmente construido y conectado. El plan maestro describe la ESPECIFICACION; este archivo describe la REALIDAD. Si se contradicen, gana este.
2. Verifica con grep antes de asumir que algo de este archivo sigue siendo cierto. Si encontras una discrepancia, reportala ANTES de construir nada encima.
3. Nada se marca "completo" sin evidencia concreta (comando + resultado) al lado.
4. Se actualiza este archivo EN CADA TAREA, no al final del bloque. Si terminaste una tarea y no la registraste aca, no esta terminada.

## BLOQUE A - Proveedores y saneo

### A1 - Modos de API key (self-host / hosted)

PENDIENTE DE AUDITAR. Se dio por hecho al inicio del proyecto pero nunca se verifico con rigor. tests/test_provider_connection_flow.js solo verifica el flujo de conexion OAuth/PKCE y el guard de OpenRouter, NO verifica que la clave NO llegue a la base de datos ni a los logs en modo self-host. Criterio de cierre del plan: en modo self-host, la clave del usuario NO debe aparecer en la base de datos ni en ningun log (test tests/test_keys_selfhost.py).

HALLAZGO A1 (2026-07-26): config.js guarda los proveedores de IA -incluidas sus API keys- en localStorage via DB.insert('ai_providers'). Esto contradice directamente el fundamento de A1: la investigacion del plano descarta localStorage por ser facil de exfiltrar con XSS, y exige Web Crypto API + IndexedDB. Ademas, config.js NO usa el modelo SQLAlchemy AIProvider que existe en backend/app/models/base.py (que soporta slug, provider_type, mode, base_url, api_key_encrypted, encryption_version, etc). config.js y el backend AIProvider son dos mundos paralelos que no se hablan. Este es el punto de concreto de A1 cuando se aborde.

### A2 - Eliminar importador de roadmap.sh

Motivo: la licencia de roadmap.sh prohibe redistribuir su contenido; hacer scraping no lo legaliza.

Backend LIMPIO (verificado con grep, 2026-07-26):
- Eliminados: catalogo hardcodeado de 40+ roadmaps, endpoints /sh/roadmaps y /sh/import, schemas RoadmapShImportRequest y RoadmapShRoadmapResponse, funciones _parse_roadmap_sh_html, _transform_roadmap_sh_data, _extract_roadmap_from_content, _enhance_roadmap_with_ai.
- Eliminado el valor "roadmapsh" del enum RoadmapSource en base.py.
- Queda solo un comentario de seccion (# ROADMAP.SH INTEGRATION, roadmap.py:519) sin codigo funcional detras.
- App arranca sin errores tras la limpieza.

NOTA: app/services/ai.py::enhance_roadmap_with_ai() sigue viva e intacta A PROPOSITO. El envoltorio borrado era solo pegamento hacia roadmap.sh. Cuando el importador nuevo o Bloque C necesiten mejorar un roadmap con IA, se llama directo a esa funcion. NUNCA restaurar el importador de roadmap.sh.

PENDIENTE de A2:
- Frontend sin limpiar: static/index.html, static/js/api.js, static/js/import-roadmap.js, static/js/roadmap.js, static/js/roadmapApi.js todavia tienen UI y llamadas a roadmap.sh.
- Creados y verificados (Paso 2, 2026-07-26):
  - backend/schemas/roadmap_import.py (schemas Pydantic: CareerImportData, PhaseImportData, TopicImportData, SubtopicImportData, ImportErrorResponse, ImportSuccessResponse)
  - backend/services/roadmap_parser.py (parser MD y JSON, 295 lineas, sin dependencias externas)
  - Fixes aplicados: (1) flush de topic pendiente al cambiar de fase (bug critico que perdia el ultimo topic de cada fase), (2) _flush_topic devuelve error en vez de lanzar ValueError, (3) stripping de BOM UTF-8 en parse_import.
  - Tests ejecutados: importacion OK, 2 fases x 2 topics con enlaces OK, topic loss between phases ASSERT PASSED, Wikipedia link con parentesis OK, BOM handling OK.
  - Limite de archivos agregado: 1 MB, 50 fases, 100 topics/fase, 200 subtopics/topic.
- Creado (Paso 3, 2026-07-26): endpoint POST /api/roadmaps/import en app/routers/roadmap.py.
  - Recibe UploadFile (.md, .markdown, .json), NUNCA URL externa.
  - Valida tamano ANTES de leer en memoria (1 MB).
  - Valida extension, luego parsea con parse_import().
  - Persiste en transaccion unica: Career + 6 ResourceCategories + Phases + Topics + Subtopics + SubtopicResources.
  - Rollback completo si falla a mitad de persistencia.
  - Rate limiting: ai_limit (5/minute) via @limiter.limit(ai_limit).
  - Defaults al persistir: Phase.accent = paleta[index % 5], Phase.description = None, Phase.status = "todo", Topic.status = "todo", Subtopic.done = False.
  - SubtopicResource solo se crea si el subtopic traia enlace en el MD/JSON.
  - Responde ImportSuccessResponse: career_id, career_title, phase_count, topic_count, subtopic_count, resource_count, warnings.
  - NOTA: career se crea SIEMPRE con is_active=False (activacion manual).
- Verificado (2026-07-26): test_import_endpoint.py pasa completo (6 tests, cleanup automatico via try/finally). Endpoint funcional.
HALLAZGO A2 (2026-07-26): el frontend tiene ARQUITECTURA DUAL. El camino de importacion por archivo .md NUNCA uso el backend. import-roadmap.js parseaba el markdown en JavaScript (parser propio, solo H1/H2/H3, sin subtopics ni enlaces) y guardaba directo en IndexedDB via DB.insert(). El backend y el endpoint POST /api/roadmaps/import son ajenos a ese flujo. La limpieza del frontend no es solo borrar roadmap.sh: es reapuntar el camino de archivo al backend y eliminar el parser JS duplicado + el guardado en IndexedDB.
- Limpieza del frontend COMPLETADA (2026-07-26):
  - Paso 1: import-roadmap.js — BORRADO: ROADMAPS_SH (~170 lineas de roadmaps hardcodeados), parser JS parseMarkdown, saveStructureToDB (IndexedDB), funciones del camino B (importFromRoadmapSH, getRoadmapSHStructure, renderPreviewFromSH, confirmImportSH), binding de $btnImportSH. REAPUNTADO: handleFileSelect ahora hace POST /api/roadmaps/import con FormData (no parsea en JS). Nuevo: renderSuccess() muestra datos del backend + warnings + aviso de activacion. Manejo de 429 explícito. Loading state con input deshabilitado. El archivo paso de ~470 a ~175 lineas.
  - Paso 2: api.js — BORRADO: importRoadmapSh() y getRoadmapShRoadmaps() + su export en el return.
  - Paso 3: roadmapApi.js — BORRADO: importRoadmapSh() y getRoadmapShRoadmaps() + sus exports en el return.
  - Paso 4: roadmap.js — BORRADO: bindImportEvents() y openImportModal() completos (tercer camino muerto) + su llamada en bindEvents().
  - Paso 5: index.html — BORRADO: panel "Desde roadmap.sh" completo (select hardcoded de 10 roadmaps, campos de perfil que no pertenecian a la vista de importacion). Reemplazado por un panel de Preview vacio que import-roadmap.js llena dinamicamente. Corregido el accept del input para incluir .json. Actualizado el view-bar-meta de "markdown · roadmap.sh · JSON" a "markdown · JSON".
- CRITERIO DE CIERRE DE A2 CUMPLIDO: grep de "roadmap.sh" en app/ y static/ = 0 resultados funcionales (verificado 2026-07-26).
- NOTA: la funcion importRoadmap() en api.js (linea ~562) llama a POST /roadmaps/import con JSON en el body. Ese endpoint ahora espera FormData (file upload), no JSON. import-roadmap.js NO usa esa funcion — hace fetch directo con FormData. importRoadmap() queda como codigo muerto potencial; revisar si generate-roadmap.js u otro archivo la usa antes de borrarla.

DECISION A2 (2026-07-26): el schema de importacion CareerImportData se mantiene tal cual (solo title e index para fases). El endpoint del importador aplica defaults al persistir, sin tocar el schema. Razon: el formato MD debe ser simple para el usuario; los campos que faltan (accent, description) dependen de datos que el usuario no tiene al escribir, y los campos que el frontend menciona (starts_on, ends_on, hours, videos) NO EXISTEN en los modelos SQLAlchemy (verificados 2026-07-26). Phase.starts_on y Phase.ends_on tampoco existen: son campos del frontend que nunca se modelaron en la BD. No se inventan campos fantasma.

Defaults aplicados por el endpoint:
- Phase.accent: paleta rotada por indice: ["#3fb950", "#58a6ff", "#d29922", "#bc8cff", "#f78166"][index % 5]
- Phase.description: None (nullable en el modelo)
- Phase.status: "todo" (default del modelo)
- Topic.status: "todo" (default del modelo)
- Topic.order: indice secuencial dentro de la fase
- Subtopic.done: False (default del modelo)
- Subtopic.order: indice secuencial dentro del topic

#### Formato de importacion MD/JSON (aprobado 2026-07-26)

Mapeo Markdown a modelo real:
- H1 ("# Titulo") -> Career.title (obligatorio, exactamente uno)
- H2 ("## Texto") -> Phase.title (texto literal completo, sin parsear numero). Phase.index = orden de aparicion (0-based)
- H3 ("### Texto") -> Topic.title. Topic.order = orden de aparicion dentro de la fase
- Lista "- Texto" -> Subtopic.title. Subtopic.order = orden de aparicion dentro del topic
- Lista "- [Texto](url)" -> Subtopic.title = "Texto", SubtopicResource.label = "Texto", SubtopicResource.url = "url"
- Career.source = "md_import", Career.source_ref = nombre del archivo
- Career.is_active = False SIEMPRE al importar (activacion manual despues)

Limites de validacion (RECHAZO si excede):
- Tamano maximo del archivo: 1 MB
- Maximo 50 fases por carrera
- Maximo 100 topics por fase
- Maximo 200 subtopics por topic

Casos limite definidos:
a) Sin H1 -> RECHAZO con mensaje
b) Mas de un H1 -> RECHAZO con mensaje
c) H3 antes de cualquier H2 (topic huerfano) -> RECHAZO con mensaje
d) "- item" antes de cualquier H3 (subtopic huerfano) -> RECHAZO con mensaje
e) H2 vacio sin ningun H3 (fase sin topics) -> RECHAZO con mensaje
f) Archivo vacio o solo espacios -> RECHAZO con mensaje
g) Supera limites de tamano/cantidad -> RECHAZO con mensaje
h) Texto suelto entre secciones (no heading ni lista) -> SE IGNORA pero se informa en "warnings" de la respuesta

Decisions de reimportacion:
- Cada importacion crea SIEMPRE una Career NUEVA, aunque el titulo sea identico a una existente
- No se borra ni actualiza carreras existentes (preserva progreso, notas, subtopics done)
- "Importar actualizando/mergeando una carrera existente" queda como IDEA FUTURA, no implementada

Archivos del importador generico:
- backend/schemas/roadmap_import.py (schemas Pydantic para request/response)
- backend/services/roadmap_parser.py (parser MD y JSON al modelo real)
- Endpoint en app/routers/roadmap.py (recibe UploadFile, no URL externa)
- tests/test_roadmap_import.py

A2 CERRADO (2026-07-26):
- Backend: endpoint POST /api/roadmaps/import funcional, rate limited (ai_limit 5/min), valida extension/tamano/estructura/longitudes, persiste en transaccion unica con rollback.
- Frontend: import-roadmap.js reimplementado — flujo de dos pasos (seleccionar archivo → clic Importar), preview "Archivo listo" antes de subir, no resetea input en error para permitir reintentos, muestra counts + aviso de activacion en exito.
- Tests: 8 tests en tests/test_roadmap_import.py (2 exito, 4 error, 1 is_active=False, 1 accent palette). Suite completa verde (20/20). No contamina test_rate_limit_integration.py.
- Verificacion manual: subida .md → preview con counts → activacion manual. Subida .txt → rechazo con mensaje. Rate limit → 429 con mensaje.
- Pendiente futuro: test que verifique que el endpoint /import respeta su limite de 5/min (test_rate_limit_integration.py no lo cubre).

### A3 - Modelo Career (multi-carrera)

PARCIAL - funcionalmente completo, formalmente sin cerrar.

HECHO Y VERIFICADO:
- Clase Roadmap renombrada a Career, tabla roadmaps -> careers.
- Phase.roadmap_id -> career_id, ResourceCategory.roadmap_id -> career_id.
- Corregidas todas las referencias en app/routers/roadmap.py (lineas 53, 144, 152, 154).
- Corregido app/schemas.py lineas 79 y 115 (PhaseResponse y ResourceCategoryResponse esperaban roadmap_id).
- VERIFICADO 2026-07-26 con evidencia real: POST /api/roadmaps/phases devuelve career_id, y GET /api/roadmaps/phases lo lee correctamente. Escritura y lectura confirmadas.

LECCION APRENDIDA: A3 se dio por cerrada la primera vez habiendo verificado solo la ESCRITURA (conteo en SQLite) y el health check. El schema de LECTURA (Pydantic) seguia roto y nadie lo noto porque no habia fases en la base. La escritura pasa por el modelo SQLAlchemy y la lectura por el schema Pydantic: verificar una no prueba la otra.

PENDIENTE PARA CERRAR A3:
- Migracion Alembic (bloqueada hasta que A6 inicialice Alembic).
- tests/test_multicareer.py: crear dos carreras distintas sin que choquen. El criterio de cierre lo exige y no existe.

NOTA: hay 3 carreras vacias en la DB, auto-creadas por get_active_roadmap() durante pruebas. Decidir si se limpian.

NOTA: las 4 ocurrencias de roadmap_id en el frontend (generate-roadmap.js:157, import-roadmap.js:438 y 448, roadmap.js:576) son codigo de roadmap.sh, no consumen respuestas del backend. Mueren cuando se limpie el frontend en A2.

### A4 - Migracion incremental a React (patron Strangler Fig)

SIN INICIAR. El frontend sigue 100% JavaScript vanilla en static/js/. No existe carpeta frontend/, ni React, ni Vite. Consecuencia: cualquier documento de otro bloque que especifique archivos .jsx describe el estado POST-A4, no el actual. Antes de crear cualquier .jsx, consultar.
Criterio de cierre: React corre al lado del frontend actual, la primera vista migrada, los tests de Playwright siguen verdes, MIGRATION.md documenta como seguir.
ADVERTENCIA: el plano asume que existen tests de Playwright verdes como red de seguridad. Verificar que existan ANTES de empezar la migracion.

### A5 - Licencia y saneo de documentacion

✅ CERRADA (2026-07-27).

ARCHIVOS CREADOS:
- LICENSE: texto oficial completo de GNU Affero General Public License v3 (661 lineas, verificado).
- NOTICE: copyright del proyecto con referencia a AGPL-3.0.
- README.md: reescrito completo reflejando la realidad del codigo.

DECISION DE LICENCIA (2026-07-27): AGPL-3.0, no MIT. Modelo open core: nucleo libre, modulo educativo (profesores/estudiantes) comercial y cerrado.
Dos consecuencias tecnicas para cuando se construya ese modulo: (1) debe estar SEPARADO del codigo AGPL, comunicandose por API o como plugin - si se integra directo, la AGPL obligaria a abrirlo; (2) antes de aceptar contribuciones externas (Bloque I) hace falta un CLA, o el codigo aportado por terceros bloquearia la venta de licencias comerciales.

CONTRADICCIONES ENCONTRADAS Y CORREGIDAS EN EL README (17 de 22 afirmaciones auditadas):

3 MENTIRAS directas:
1. Licencia decia "MIT" -> corregido a AGPL-3.0
2. B6.5 (ai_budget.py) aparecia como conectado -> aclarado que esta escrito pero sin conectar
3. "Bloques B1 a B6 implementados y validados con pruebas" -> corregido: B2 sin callers, B5 parcial, B6 parcial

5 EXAGERACIONES:
4. Diagrama mostraba B6 budget como nodo activo -> nota aclaratoria
5. Diagrama mostraba B3 y B5 como pasos intermedios -> movidos a nota como middleware global
6. "Sanitizacion de HTML" presentada como funcional -> aclarado sin callers reales
7. "Validacion de imagenes" presentada como funcional -> aclarado sin callers reales
8. docs/db_privileges.md presentado como implementado -> aclarado como stub

5 INCOMPLETOS:
9. Estructura del repo omitia app/security.py -> agregado
10. Variables de entorno incompletas -> referencia a .env.example
11. Features aspiracionales presentadas como existentes -> movidas a "lo que no existe"
12. Instrucciones de instalacion sin mkdir data -> agregado
13. Stack no aclaraba que React/PostgreSQL son aspiracionales -> nota agregada

1 OUTDATED:
14. Stack decia React vanilla sin aclarar -> aclarado como aspiracional

Pendiente futuro (no bloqueante):
- Headers de licencia en cada archivo fuente: PENDIENTE OPCIONAL para antes del lanzamiento publico (Bloque I). Son cientos de archivos, no se hace ahora.

Criterio de cierre: ✅ CUMPLIDO - LICENSE con AGPL-3.0, NOTICE con copyright, README refleja la realidad sin contradecir al codigo.

### A6 - Base de datos flexible (SQLite / PostgreSQL / MySQL)

SIN INICIAR. Y es BLOQUEADOR para cerrar A3 formalmente.
El codigo debe correr en los tres motores cambiando solo DATABASE_URL, sin SQL crudo especifico de motor, con migraciones Alembic.
Criterio de cierre: mismo codigo corre en SQLite y PostgreSQL, el test agnostico pasa en ambos, docker-compose permite ambos despliegues.

## BLOQUE B - Seguridad

CERRADO con matices:

- B1 (CI/CD con Gitleaks + Trivy): completo y verificado en remoto.
- B2 (saneamiento de entrada): modulos escritos y testeados de forma aislada, PERO sin ningun caller real. Diferido hasta que existan endpoints de scraping (Bloque D) o subida de imagenes (Bloque E). DUDA TECNICA ABIERTA: sanitize_rich_text() usa Bleach con strip=True; verificar si realmente remueve texto oculto (display:none) antes de conectarla, o si hace falta cambiar de enfoque.
- B3 (rate limiting): completo, integrado y con test de integracion real contra la app (429 verificado).
- B4 (cifrado en reposo): app/security.py funcional y usado en providers.py. DEUDA: backend/security/encryption.py es un duplicado sin caller - eliminar o justificar.
- B5 (cabeceras de seguridad): parcial. Solo cabeceras estaticas (HSTS, X-Content-Type-Options, X-Frame-Options). Falta redirect HTTPS y gating por APP_ENV/FORCE_HTTPS/TRUST_PROXY_HEADERS - diferido a Bloque H (despliegue), depende de si habra reverse proxy.
- B6 (guardian IA + DB): parcial. B6.2 implementado con enfoque distinto al especificado (ai_guard.py enmascara con regex; el plan pedia output_guard.py con validacion de esquema Pydantic que rechaza). B6.3 sin iniciar. B6.4: existe docs/db_privileges.md pero es un stub/politica, no implementacion (falta deploy/db_roles.sql y tests/test_db_privileges.py). B6.5 (ai_budget.py) escrito pero sin conectar - espera Bloque F1 (registry.py).

## BLOQUE C - Motor de roadmaps

CONGELADO. No se toca hasta que Bloque A este 100% cerrado.

Decisiones ya tomadas sobre el modelo real (para cuando lleguemos):
- Subtopic YA EXISTE (cuelga de Topic) - se amplia con teoria_tipo y teoria_contenido, no se crea tabla nueva.
- Resource YA EXISTE (cuelga de category_id) - se le agrega subtopic_id como FK adicional nullable, sin tocar category_id.
- Project YA EXISTE (con repo_name/repo_url/status/checklist_items) - se le agregan titulo y pasos. checklist_items es tracking de progreso, distinto de "pasos" (instrucciones).
- Topic es una capa intermedia real que el plan no anticipa; queda intacta, C1 no la usa.

## DEUDA TECNICA GENERAL

- Alembic pinneado en requirements.txt pero NUNCA inicializado. La app usa create_all(). Cuando se inicialice, el proceso correcto NO es "init + autogenerate" (recrearia tablas existentes), sino: init, configurar env.py, alembic stamp head, recien ahi migrar.
- api.js y roadmapApi.js son wrappers de API DUPLICADOS que hacen lo mismo. Decidir cual se queda.
- Alias Roadmap = Career en base.py - temporal, eliminar tras limpiar frontend.
- tools/recombine.py es un script utilitario para recombinar archivos .partNNN (no del plan). docs/superpowers/ y docs/images/ son assets documentales. static/data/seed.js es el seed de datos iniciales del frontend (usa esquema antiguo: phase_id, soporta UNA sola carrera). Ver analisis completo en A3 o seccion de seed.
- HALLAZGO (2026-07-27): static/js/labs.js contiene LABS_DATA hardcodeado con ~15 laboratorios de TryHackMe, Hack The Box y otras plataformas (nombres, descripciones, URLs de sus cursos). Mismo patron que el catalogo de roadmap.sh que se elimino en A2. PENDIENTE: revisar si redistribuir ese catalogo tiene problema de licencia, y si esos labs deberian venir de Scrapling (Bloque D) en vez de estar hardcodeados. No tocar hasta llegar a Bloque D o E.

## IDEAS PARA BLOQUES FUTUROS (no implementar todavia)

- Importar actualizando/mergeando una carrera existente. Razones para no implementar: borrar carrera por coincidencia de titulo es destructivo y silencioso (usuario pierde progreso sin avisar); mergear es complejo y ambiguo (que pasa si usuario borro un topic en el MD nuevo). Crear siempre nueva es predecible y seguro.
- Seccion "Premium recomendados" en Resource: agregar campo es_premium (boolean, default false). Diferencia de los recursos gratuitos de scraping. Candidato de ejemplo: kodekloud.com.

# BITÁCORA — Bloque A: Sanear la base
## Documento de especificación milimétrica (el plano exacto)

Este documento es el plano de construcción del Bloque A. La IA no decide nada: construye exactamente lo que aquí dice. Si algo no está en este plano, la IA pregunta al programador (mandamiento 3.3.2 del plan maestro), no inventa.

**Regla de oro de este bloque:** no se construye ninguna función nueva hasta que la base esté sana. Es fundación antes que paredes.

> **NOTA DE LECTURA (agregada 2026-07-26):** este documento describe lo que DEBE construirse. El estado REAL de lo ya construido vive en `00-START-HERE.md`. Si ambos se contradicen, para saber qué está hecho gana `00-START-HERE.md`; para saber qué falta hacer, gana este documento. Cada función de abajo lleva ahora un bloque `ESTADO REAL` con lo verificado hasta la fecha.

---

## MANDAMIENTOS DE CONSTRUCCIÓN (léelos antes de escribir una sola línea)

Estas reglas son obligatorias para cualquier IA o persona que construya sobre este plano. Están aquí, a la vista, para que nadie que tome solo este documento se las salte. Violarlas es motivo de rechazar el cambio.

1. **NO reescribas código completo desde cero.** Si algo se puede mejorar, mejóralo puntualmente. Si de verdad crees que hace falta reescribir, PREGUNTA al programador y explica por qué. Él investiga o consulta antes de decidir. Nunca decides tú solo botar y rehacer.
2. **NO asumas nada.** Si algo no está en este plano o no está claro, PREGUNTA. Una suposición mal hecha cuesta más que una pregunta.
3. **Explica antes de hacer.** Antes de aplicar un cambio, di qué vas a hacer y por qué. El programador aprende de esa explicación; es parte del objetivo.
4. **Un paso a la vez.** No adelantes funciones. Haz solo la función que el plano indica en esta sesión, ciérrala, pruébala, y espera antes de seguir.
5. **Construye SOLO lo que dice el plano.** Nada de features extra "de regalo", nada de librerías que nadie pidió, nada de cambios de arquitectura no autorizados. Si crees que algo falta, proponlo y espera aprobación.
6. **Cada cambio se trata como código externo:** el programador lo revisa y aprueba antes de que llegue a producción. Tú propones; él decide.
7. **Verifica cada dependencia antes de instalarla.** No instales paquetes que la IA "supone" que existen (riesgo de slopsquatting). Confirma que el paquete es real y mantenido.
8. **Código de calidad y organizado.** Nombres claros, funciones cortas con una sola responsabilidad, comentarios donde el porqué no sea obvio. El código se documenta por dentro.
9. **La bitácora de avance va FUERA del código.** Al terminar cada sesión, escribe en las notas del plan (sección 9 del plan maestro) qué hiciste, qué quedó pendiente y advertencias para la siguiente sesión.
10. **Si tienes dudas, la respuesta es preguntar, no adivinar.** Ante cualquier ambigüedad, para y consulta al programador.

> **MANDAMIENTO 11 (agregado 2026-07-26):** **Evidencia cruda, nunca descripciones.** Cuando reportes un cambio, pega el diff literal y el output literal del comando. Escribir "verifiqué que funciona" o "el test pasa" NO es evidencia. Esta regla se agregó tras detectar reportes con evidencia fabricada (listas de números de línea inventadas) y tareas marcadas como completas que no lo estaban.
>
> **MANDAMIENTO 12 (agregado 2026-07-26):** **`00-START-HERE.md` se actualiza EN CADA TAREA, no al final del bloque.** Si terminaste una tarea y no está registrada ahí, la tarea NO está terminada. Es el único puente entre sesiones de distintas IAs.

---

## Stack confirmado para todo el proyecto

- **Backend:** Python + FastAPI + SQLAlchemy.
- **Base de datos: flexible, NO clavada a una sola.** Gracias a SQLAlchemy, la base de datos se elige por configuración (variable de entorno `DATABASE_URL`), sin reescribir código. Debe funcionar con:
  - **SQLite** — para desarrollo local y para que alguien pruebe Bitácora en su PC sin instalar nada.
  - **PostgreSQL** — recomendada para servidor online y servidor local serio.
  - **MySQL/MariaDB** — soportada como alternativa.
  El código NUNCA debe asumir que la base es SQLite. Nada de SQL crudo específico de un motor; todo pasa por SQLAlchemy y las migraciones por Alembic. Así el mismo código corre en local con SQLite y en producción con PostgreSQL solo cambiando `DATABASE_URL`.
- **Frontend:** se migra de JavaScript vanilla a React, de forma incremental (ver Función A4).
- **Contenedores:** Docker + docker-compose (se conserva, se pule). El compose debe permitir levantar Bitácora con SQLite (simple) o con un contenedor de PostgreSQL al lado, según el despliegue.
- **Despliegue en tres capas** (decisión del plan maestro): local (PC), servidor propio (homelab), e internet (VPS/nube). La base de datos flexible es justo lo que hace esto posible: SQLite para probar rápido, PostgreSQL cuando el despliegue es serio.

> **ESTADO REAL DEL STACK (2026-07-26):**
> - El frontend HOY es **JavaScript vanilla** en `static/js/`. La migración a React (A4) NO se ha iniciado. Cualquier documento de otro bloque que mencione rutas `frontend/src/components/*.jsx` está describiendo el estado FUTURO post-A4, no el actual. Antes de crear cualquier `.jsx`, confirmar con el programador.
> - La base de datos HOY es **SQLite** vía `create_all()`. **Alembic está pinneado en `requirements.txt` pero NUNCA se inicializó** (no existe carpeta `alembic/`, ni `env.py`, ni `versions/`). Esto afecta directamente a A3 y A6 (ver notas en esas funciones).

---

## Índice del Bloque A
- A1. Resolver la contradicción de las API keys
- A2. Neutralizar y reconvertir el importador de roadmap.sh
- A3. Reencuadrar el contenido sembrado a multi-carrera
- A4. Migración incremental a React (patrón Strangler Fig)
- A5. Licencia MIT y saneo de documentación
- A6. Base de datos flexible (SQLite / PostgreSQL / MySQL)

> **TABLERO DE ESTADO (actualizado 2026-07-26):**
>
> | Función | Estado | Nota |
> |---|---|---|
> | A1 — API keys | ⏳ SIN INICIAR | Nunca se auditó. Es la deuda de seguridad que el plano marca como bloqueante. |
> | A2 — Importador roadmap.sh | 🔨 EN CURSO | Backend limpio. Parser y endpoint creados y verificados. Falta: limpieza de frontend. |
> | A3 — Multi-carrera | ⚠️ PARCIAL | Escritura y lectura verificadas (schemas.py corregido). Falta: migración Alembic, test_multicareer.py. |
> | A4 — Migración React | ⏳ SIN INICIAR | El frontend sigue 100% vanilla. |
> | A5 — Licencia MIT + README | ⏳ SIN INICIAR | No verificado si existe `LICENSE`. |
> | A6 — Base de datos flexible | ⏳ SIN INICIAR | Bloqueada por Alembic sin inicializar. |
>
> **ADVERTENCIA DE ORDEN:** el orden de ejecución del plano es A1 → A5 → A6 → A2 → A3 → A4. En la práctica se ejecutó A3 primero y luego A2, saltando A1, A5 y A6. Consecuencia a tener en cuenta: A6 (base agnóstica de motor) puede obligar a retocar el modelo que A3 ya modificó, que es justo lo que la Nota 1 del plano quería evitar.

---

# FUNCIÓN A1 — Resolver la contradicción de las API keys

> **ESTADO REAL (2026-07-26): ⏳ SIN INICIAR.** Se dio por hecho al comienzo del proyecto pero nunca se auditó con rigor. NO existe `tests/test_keys_selfhost.py`. Es la primera función que el plano manda hacer y sigue pendiente. Al auditarla, verificar primero (solo lectura) si la clave del usuario llega hoy al servidor, la base de datos o los logs — no asumir que el flujo actual ya cumple.

## A1.0 Investigación (fundamento, no opinión)

El diseño correcto tiene dos modos y NO son intercambiables:

**Modo self-host (el usuario trae su clave).** La clave nunca debe tocar el servidor. La investigación de seguridad 2026 es clara: <fuente: devtoolkit.cloud, feb 2026> localStorage es demasiado fácil de exfiltrar con un ataque XSS, así que NO se usa localStorage para claves. La recomendación es cifrar con Web Crypto API (AES-GCM, que es cifrado autenticado: si alguien altera el dato, el descifrado falla) y, si hay que guardar la clave, hacerlo como objeto CryptoKey en IndexedDB, no en localStorage. El IV (vector de inicialización) debe ser único y aleatorio en cada cifrado, nunca reusado.

**Modo hosted (la clave es del dueño de la instancia).** Aquí sí vive en el servidor. La práctica estándar: <fuente: roihacks.com, 2026> el backend lee la clave secreta de configuración server-side, el servidor llama a la API externa, y solo devuelve al navegador lo necesario; el secreto nunca cruza al cliente. Esto además da un lugar central para validación, logging, rate limiting y caché. La clave se cifra en reposo y se sirve siempre por HTTPS/TLS.

**Conclusión de diseño:** una variable de configuración `BITACORA_MODE` con valores `self-host` o `hosted` decide el comportamiento. Los dos caminos existen desde el código; el modo elige cuál corre.

## A1.1 Qué hace exactamente esta función
Separar en el código los dos modos de manejo de claves, de forma que:
- En `self-host`: la clave del usuario se cifra en el navegador (AES-GCM vía Web Crypto API), se guarda en IndexedDB, y JAMÁS se envía al backend, ni a la base de datos, ni a los logs. Las llamadas a la IA se hacen desde el navegador directo al proveedor, o el backend actúa solo de proxy sin almacenar la clave.
- En `hosted`: la clave la pone el dueño de la instancia en el `.env` del servidor, cifrada en reposo, y el backend hace las llamadas.

## A1.2 Lenguaje y archivos

| Archivo | Lenguaje | Nuevo o editar | Qué contiene |
|---|---|---|---|
| `frontend/src/lib/keyVault.js` | JavaScript (Web Crypto API) | NUEVO | Cifrar/descifrar la clave del usuario con AES-GCM, guardar/leer de IndexedDB. Nunca la manda al backend. |
| `frontend/src/lib/aiClient.js` | JavaScript | NUEVO | En self-host, llama al proveedor de IA usando la clave descifrada en memoria (no persiste en texto plano). |
| `backend/config.py` | Python | EDITAR | Añadir `BITACORA_MODE` (self-host/hosted) leído de variable de entorno. |
| `backend/routers/providers.py` | Python | EDITAR | En self-host, NO guardar claves; en hosted, leerlas cifradas del servidor. |
| `backend/security/crypto.py` | Python | NUEVO | Cifrado en reposo de las claves en modo hosted (AES-256). |
| `backend/.env.example` | texto | EDITAR | Documentar `BITACORA_MODE` y dónde van las claves en cada modo. |
| `tests/test_keys_selfhost.py` | Python | NUEVO | Test que confirma que en self-host ninguna clave llega a DB ni logs. |

Total función A1: 5 archivos nuevos, 3 editados.

> **AJUSTE DE RUTAS (2026-07-26):** las rutas `frontend/src/lib/*.js` de esta tabla asumen la estructura post-A4 (React). Como A4 no se ha hecho, el equivalente real hoy está en `static/js/`. El repo ya tiene `static/js/encryption.js` y `static/js/provider-connection.js` — antes de crear archivos nuevos, verificar qué de esto ya existe y ampliarlo en vez de duplicarlo (mandamiento 1).

## A1.3 Diagrama de flujo

```
Usuario escribe su API key en el frontend
                 │
                 ▼
       ¿BITACORA_MODE?
        │              │
   self-host         hosted
        │              │
        ▼              ▼
 keyVault.js      La clave la puso
 cifra (AES-GCM)  el dueño en .env
 guarda en        (cifrada en reposo
 IndexedDB        por crypto.py)
        │              │
        ▼              ▼
 aiClient.js      backend/providers.py
 descifra en      lee la clave del
 memoria solo     servidor
 al momento de
 llamar
        │              │
        └──────┬───────┘
               ▼
      Llamada al proveedor de IA
      (siempre por HTTPS/TLS)
               │
               ▼
   test_keys_selfhost.py verifica:
   en self-host, grep de la clave en
   DB y logs = 0 resultados
```

## A1.4 Prompt copy-paste para la IA

```
Lee BITACORA-plan-maestro.md y BITACORA-bloque-A-especificacion.md antes de tocar nada.
No asumas; si algo no está en el plano, pregúntame.

Tarea: Función A1 — separar los dos modos de API keys.

PASO 1 (solo lectura, no cambies nada todavía):
Traza el camino actual de una API key de usuario en el código: desde el input del
frontend hasta dónde se guarda. Muéstrame el trazado y señala exactamente dónde
la clave toca el servidor, la base de datos o los logs. Espera mi confirmación.

PASO 2 (tras mi OK):
Crea el módulo de bóveda de claves usando Web Crypto API con AES-GCM. Requisitos:
- IV único y aleatorio por cada cifrado, nunca reusado.
- La clave cifrada se guarda como CryptoKey en IndexedDB, NO en localStorage.
- Expón funciones: saveKey(providerName, apiKey), getKey(providerName), deleteKey(providerName).
- Ruta: adaptar a la estructura real del repo (static/js/ mientras A4 no esté hecha).
  Revisa primero static/js/encryption.js — si ya cubre parte de esto, amplíalo,
  no lo dupliques.
Explícame el código antes de que yo lo apruebe.

PASO 3 (tras mi OK):
Crea backend/config.py con BITACORA_MODE leído de variable de entorno (valores:
'self-host' | 'hosted', default 'self-host'). Edita el router de providers:
en self-host NO persistas claves de usuario; en hosted léelas desde crypto.py.
Crea el módulo de cifrado en reposo (AES-256) solo para modo hosted. OJO: el repo
ya tiene app/security.py con encrypt_api_key/decrypt_api_key funcionando — amplía
eso en vez de crear un tercer módulo de cifrado.

PASO 4:
Crea tests/test_keys_selfhost.py: en modo self-host, tras configurar una clave,
verifica que NO aparece en la base de datos ni en ningún log. El test debe fallar
si la clave se filtra.

Al terminar, actualiza 00-START-HERE.md con lo que hiciste y lo que quedó pendiente.
```

## A1.5 Criterio de cierre
El test `test_keys_selfhost.py` pasa en verde: en self-host, la clave del usuario no está en DB ni en logs. Los dos modos funcionan según `BITACORA_MODE`.

---

# FUNCIÓN A2 — Neutralizar y reconvertir el importador de roadmap.sh

> **ESTADO REAL (2026-07-26): 🔨 EN CURSO.**
> - ✅ Backend limpio y verificado con grep: eliminados el catálogo hardcodeado de 40+ roadmaps, los endpoints `/sh/roadmaps` y `/sh/import`, los schemas `RoadmapSh*`, y las funciones `_parse_roadmap_sh_html`, `_transform_roadmap_sh_data`, `_extract_roadmap_from_content`, `_enhance_roadmap_with_ai`. También se quitó el valor `roadmapsh` del enum `RoadmapSource`. La app arranca sin errores.
> - ⚠️ **NOTA CRÍTICA:** `app/services/ai.py::enhance_roadmap_with_ai()` sigue viva A PROPÓSITO — el envoltorio borrado era solo pegamento hacia roadmap.sh. **NUNCA restaurar el importador de roadmap.sh.**
> - 🔨 Pendiente: crear `roadmap_import.py` y `roadmap_parser.py`, el endpoint que recibe archivo subido, limpiar los 5 archivos de frontend (`static/index.html`, `static/js/api.js`, `static/js/import-roadmap.js`, `static/js/roadmap.js`, `static/js/roadmapApi.js`), y el test.
> - El formato de importación MD/JSON ya está definido y aprobado — ver `00-START-HERE.md`, sección "Formato de importación MD/JSON".

## A2.0 Investigación
Confirmado en el plan maestro: la licencia de roadmap.sh prohíbe redistribuir su contenido, y extraerlo con scraper no lo legaliza. Pero la MAQUINARIA de importación es valiosa y no se bota: se reapunta a una fuente legal (el MD/JSON que sube el usuario, Vía 2 del plan maestro).

> **PRECISIÓN AGREGADA (2026-07-26):** no alcanza con eliminar el scraping en vivo. El catálogo hardcodeado de títulos, descripciones, tags y URLs de roadmap.sh embebido en el código **también** es contenido de ellos redistribuido, y se elimina igual.

## A2.1 Qué hace exactamente
- Elimina toda llamada al contenido de roadmap.sh.
- Reconvierte `RoadmapShImportRequest` / `RoadmapShRoadmapResponse` en un importador genérico que acepta el MD/JSON del usuario con el formato de la sección 10 del plan maestro.

## A2.2 Lenguaje y archivos

| Archivo | Lenguaje | Nuevo o editar | Qué contiene |
|---|---|---|---|
| `backend/routers/roadmap.py` | Python | EDITAR | Quitar endpoints que apuntan a roadmap.sh; añadir endpoint de importación de archivo del usuario. |
| `backend/schemas/roadmap_import.py` | Python (Pydantic) | NUEVO (renombra el viejo) | Modelo de importación genérico, no atado a roadmap.sh. |
| `backend/services/roadmap_parser.py` | Python | NUEVO | Parsea el MD/JSON del usuario al modelo interno. |
| `tests/test_roadmap_import.py` | Python | NUEVO | Acepta un MD válido, rechaza formato inválido, confirma que ya no hay ruta a roadmap.sh. |

Total función A2: 3 archivos nuevos, 1 editado. (Se elimina el schema viejo `RoadmapSh*`.)

> **AJUSTE DE RUTA (2026-07-26):** el router real está en `app/routers/roadmap.py`, no `backend/routers/`. Los módulos nuevos van en `backend/` (módulos reutilizables) mientras que `app/` es la aplicación FastAPI. Verificar que `backend/` sea importable (que existan los `__init__.py`) antes de dar el endpoint por funcionando.
>
> **AJUSTE DE ALCANCE (2026-07-26):** la tabla no menciona el frontend, pero hay 5 archivos de frontend con UI y llamadas a roadmap.sh que también deben limpiarse para cumplir el criterio de cierre. Están listados en el bloque ESTADO REAL de arriba.

## A2.3 Diagrama de flujo

```
Usuario sube archivo MD/JSON de su roadmap
                 │
                 ▼
   roadmap.py: endpoint /import (archivo del usuario)
                 │
                 ▼
   roadmap_parser.py valida contra
   schemas/roadmap_import.py
        │                 │
    válido            inválido
        │                 │
        ▼                 ▼
   guarda en DB     error claro al usuario
   (multi-carrera)  con qué corregir
        │
        ▼
   test_roadmap_import.py verifica:
   - MD válido entra
   - inválido se rechaza
   - grep "roadmap.sh" en código = 0
```

## A2.4 Prompt copy-paste

```
Lee el plan maestro y este documento antes de tocar nada. No asumas; pregúntame si dudas.

Tarea: Función A2 — neutralizar el importador de roadmap.sh y reconvertirlo.

PASO 1 (solo lectura): localiza en el código todas las referencias a roadmap.sh
(RoadmapShImportRequest, RoadmapShRoadmapResponse, cualquier URL a roadmap.sh),
tanto en app/ como en static/. Lístamelas con evidencia cruda de grep y espera mi OK.

PASO 2 (tras OK): elimina del backend todo el código de roadmap.sh, incluido el
catálogo hardcodeado de roadmaps (no solo el scraping en vivo). Espera mi OK.

PASO 3: crea backend/schemas/roadmap_import.py con un modelo Pydantic genérico y
backend/services/roadmap_parser.py que parsee MD o JSON al modelo real del repo
(Career → Phase → Topic → Subtopic → SubtopicResource). El parser NO debe tocar
la base de datos: solo parsea y devuelve una estructura, para poder testearlo sin DB.

PASO 4: edita el router: añade el endpoint que recibe el archivo subido (UploadFile),
nunca una URL externa.

PASO 5: limpia los archivos de frontend que tienen UI y llamadas a roadmap.sh.
Antes de tocarlos, muéstrame su contenido completo y espera mi OK.

PASO 6: crea tests/test_roadmap_import.py: acepta un MD de ejemplo válido, rechaza
uno inválido con mensaje claro, y confirma con grep que ya no queda ninguna
referencia funcional a "roadmap.sh" en app/ ni en static/.

Actualiza 00-START-HERE.md al terminar cada paso, no solo al final.
```

## A2.5 Criterio de cierre
No queda ninguna referencia a roadmap.sh en el código. El importador acepta el archivo del usuario y rechaza formatos inválidos con mensaje claro.

---

# FUNCIÓN A3 — Reencuadrar el contenido sembrado a multi-carrera

> **ESTADO REAL (2026-07-26): ⚠️ PARCIAL — funcionalmente completo, formalmente sin cerrar.**
> - ✅ Clase `Roadmap` renombrada a `Career`, `__tablename__` de `roadmaps` a `careers`.
> - ✅ `Phase.roadmap_id` → `Phase.career_id` (FK a `careers.id`), y `ResourceCategory.roadmap_id` → `career_id`.
> - ✅ Corregidas todas las referencias en `app/routers/roadmap.py` (líneas 53, 144, 152, 154).
> - ✅ **schemas.py corregido (2026-07-26):** `PhaseResponse.roadmap_id` y `ResourceCategoryResponse.roadmap_id` → `career_id` (líneas 79 y 115).
> - ✅ **VERIFICADO 2026-07-26 con evidencia real:** POST /api/roadmaps/phases devuelve `career_id`, GET /api/roadmaps/phases lo lee correctamente. Escritura y lectura confirmadas.
> - **LECCIÓN APRENDIDA:** A3 se dio por cerrada la primera vez habiendo verificado solo la ESCRITURA (conteo en SQLite) y el health check. El schema de LECTURA (Pydantic) seguía roto y nadie lo notó porque no había fases en la base. La escritura pasa por el modelo SQLAlchemy y la lectura por el schema Pydantic: verificar una no prueba la otra.
> - ⚠️ **FALTA la migración Alembic** que la tabla A3.2 exige — se usó `create_all()` porque Alembic nunca se inicializó. **A3 no puede darse por cerrada hasta que A6 resuelva Alembic y se genere esta migración.**
> - ⚠️ **FALTA `tests/test_multicareer.py`** (crear dos carreras distintas sin que choquen). El criterio de cierre lo exige y no existe.
> - ℹ️ Hay **3 carreras vacías** en la DB (auto-creadas por `get_active_roadmap` en pruebas). Decidir si se limpian.
> - ℹ️ Queda un alias `Roadmap = Career` en `base.py` por compatibilidad temporal. Eliminarlo cuando el frontend esté limpio.
> - ℹ️ **Las 4 ocurrencias de `roadmap_id` en el frontend** (`generate-roadmap.js:157`, `import-roadmap.js:438,448`, `roadmap.js:576`) son código de roadmap.sh, no consumen respuestas del backend. Mueren cuando se limpie el frontend en A2.

## A3.0 Investigación
El modelo de datos actual trata el roadmap de Cloud Security como el único. El motor debe soportar varias carreras conviviendo (decisión del plan maestro). El roadmap de seguridad no se borra: pasa a ser un roadmap de ejemplo entre varios.

## A3.1 Qué hace exactamente
Ajusta el modelo de datos para que una tabla `Career` (carrera) sea la raíz, y las fases cuelguen de una carrera. Migra el seed actual para que Cloud Security sea una carrera de ejemplo.

## A3.2 Lenguaje y archivos

| Archivo | Lenguaje | Nuevo o editar | Qué contiene |
|---|---|---|---|
| `backend/models.py` | Python (SQLAlchemy) | EDITAR | Añadir modelo `Career`; `Phase` ahora tiene `career_id`. |
| `backend/migrations/xxxx_add_career.py` | Python (Alembic) | NUEVO | Migración de base de datos que añade la tabla y la relación. |
| `backend/seed.py` | Python | EDITAR | Cloud Security pasa a ser una `Career` de ejemplo. |
| `tests/test_multicareer.py` | Python | NUEVO | Crear dos carreras distintas sin que choquen. |

Total función A3: 2 archivos nuevos, 2 editados.

> **AJUSTE DE RUTA (2026-07-26):** el modelo real está en `app/models/base.py`, no `backend/models.py`. El seed real es `seed_if_empty()` y hoy es un placeholder vacío (no siembra nada de fábrica).

## A3.3 Diagrama de flujo (modelo de datos)

```
Career (NUEVO — la raíz)
  │  id, nombre, meta, duracion_meses, horas_dia, nivel
  ▼
Phase (EDITAR — ahora tiene career_id)
  │
  ▼
Subtopic ── teoria (video/texto/doc) + Resource (con crédito)
  │
  ▼
Project (varios por fase) ── rutas de despliegue
```

> **JERARQUÍA REAL (2026-07-26):** el modelo del repo tiene una capa intermedia que este diagrama no contempla:
> ```
> Career → Phase → Topic → Subtopic → SubtopicResource
>                     └──► Project
> ```
> `Topic` existe, tiene CRUD propio en el router y se consume en el frontend. No se elimina ni se fusiona.

## A3.4 Prompt copy-paste

```
Lee el plan maestro y este documento. No asumas; pregúntame si dudas.

Tarea: Función A3 — modelo multi-carrera.

PASO 1 (solo lectura): muéstrame el modelo de datos actual y cómo está sembrado
el roadmap de Cloud Security. Espera mi OK.

PASO 2 (tras OK): edita el modelo para añadir Career como raíz y career_id a Phase.
Explícame el cambio de esquema antes de aplicarlo.

PASO 3: crea la migración Alembic correspondiente. (BLOQUEADO hasta que A6
inicialice Alembic correctamente — ver nota de A6.)

PASO 4: edita el seed para que Cloud Security sea una Career de ejemplo,
no el único roadmap.

PASO 5: crea tests/test_multicareer.py que cree dos carreras distintas y confirme
que conviven sin chocar.

Actualiza 00-START-HERE.md al terminar.
```

## A3.5 Criterio de cierre
La base de datos soporta varias carreras. Cloud Security es una de ejemplo. El test de multi-carrera pasa.

---

# FUNCIÓN A4 — Migración incremental a React (patrón Strangler Fig)

> **ESTADO REAL (2026-07-26): ⏳ SIN INICIAR.** El frontend sigue siendo 100% JavaScript vanilla en `static/js/`. No existe carpeta `frontend/`, ni React, ni Vite. **Consecuencia importante:** cualquier documento de otro bloque (especialmente Bloque C) que especifique archivos `.jsx` está describiendo el estado post-A4. Mientras A4 no se haga, esos archivos se adaptan a `static/js/` — y esa adaptación se consulta con el programador, no se decide sola.

## A4.0 Investigación (esto es delicado, por eso va fundamentado)

La forma correcta de migrar de vanilla JS a React NO es reescribir todo de golpe. La investigación es unánime: <fuente: codelit.io, mar 2026 / threenorth.io, nov 2025> las reescrituras "big-bang" fallan más de lo que triunfan; el patrón Strangler Fig reemplaza el sistema pieza por pieza mientras el viejo sigue corriendo, sin downtime. <fuente: leanderhoedt.dev> este patrón se usó específicamente para migrar apps a React, envolviendo componentes React alrededor del código viejo y reemplazándolo gradualmente.

Reglas de la migración segura, de la investigación: <fuente: javascript.plainenglish.io, 2025> empieza con una tajada casi trivialmente pequeña para ganar confianza antes de la complejidad; si algo sale mal, revertir es trivial; una vez que la tajada nueva es estable, borra el código viejo. <fuente: xebia.com, ene 2026> el punto difícil del código legacy es que las transiciones de estado y las actualizaciones del DOM están mezcladas; el primer paso es separarlas metiendo el estado en un componente.

**Conclusión de diseño:** se monta React al lado del frontend actual, se migra UNA vista pequeña primero (la más simple), se prueba, y solo entonces se migra la siguiente. El frontend vanilla y el React conviven durante la migración.

## A4.1 Qué hace exactamente
1. Instala React (con Vite como bundler) en el proyecto, conviviendo con el frontend actual.
2. Migra la primera vista pequeña (la de menú/navegación o una simple) a React.
3. Deja documentado el patrón para migrar las demás vistas una por una.

## A4.2 Lenguaje y archivos

| Archivo | Lenguaje | Nuevo o editar | Qué contiene |
|---|---|---|---|
| `frontend/package.json` | JSON | NUEVO/EDITAR | Dependencias React + Vite. |
| `frontend/vite.config.js` | JavaScript | NUEVO | Config del bundler. |
| `frontend/src/App.jsx` | React (JSX) | NUEVO | Raíz de la app React. |
| `frontend/src/components/Sidebar.jsx` | React | NUEVO | Primera vista migrada (la navegación). |
| `frontend/src/legacy/` | — | MOVER | El código vanilla actual se mueve aquí, sigue funcionando. |
| `frontend/MIGRATION.md` | texto | NUEVO | El patrón paso a paso para migrar cada vista siguiente. |
| `tests/ui.spec.js` | JavaScript (Playwright) | EDITAR | Los tests existentes deben seguir pasando durante la migración. |

Total función A4: 5 nuevos, 1 editar, 1 mover.

> **VERIFICAR ANTES DE EMPEZAR (2026-07-26):** este plano asume que existen 10 tests de Playwright verdes que sirven de red de seguridad para la migración. **Confirmar con evidencia cruda que esos tests existen y pasan hoy** antes de mover una sola línea de frontend. Sin esa red, la migración pierde su mecanismo de reversión seguro.

## A4.3 Diagrama de flujo (la migración)

```
Frontend vanilla actual (funciona, 10 tests verdes)
                 │
                 ▼
   Instalar React + Vite AL LADO (no reemplaza)
                 │
                 ▼
   Migrar 1 vista pequeña (Sidebar) a React
                 │
                 ▼
   ¿Los 10 tests siguen verdes?
        │              │
       sí             no
        │              │
        ▼              ▼
   borrar esa vista   revertir (trivial),
   vieja, seguir      arreglar, reintentar
   con la próxima
                 │
                 ▼
   Repetir vista por vista hasta que
   todo el frontend sea React.
   Al final se borra frontend/src/legacy/
```

## A4.4 Prompt copy-paste

```
Lee el plan maestro y este documento. Esto es una migración delicada: NO reescribas
todo de golpe. Sigue el patrón Strangler Fig. No asumas; pregúntame si dudas.

Tarea: Función A4 — montar React al lado del frontend actual y migrar la primera vista.

PASO 0: confírmame con evidencia cruda que los tests de Playwright existen y pasan
hoy. Si no existen, paramos: sin red de seguridad no se migra.

PASO 1: instala React con Vite, conviviendo con el código vanilla actual.
Mueve el código vanilla a legacy/ sin romperlo. Confírmame que los tests siguen
pasando antes de seguir.

PASO 2 (tras OK): migra SOLO la vista más simple (la navegación/sidebar) a React.
Separa el estado del DOM (mete el estado en el componente). No toques las demás
vistas todavía.

PASO 3: corre los tests. Si alguno falla, revierte y dime qué pasó. Si pasan,
borra el código vanilla de esa vista.

PASO 4: escribe MIGRATION.md con el patrón exacto para migrar la próxima vista,
de modo que cualquier IA pueda seguirlo.

Actualiza 00-START-HERE.md al terminar. NO migres más vistas en esta sesión;
una a la vez.
```

## A4.5 Criterio de cierre
React corre al lado del frontend actual. La primera vista está migrada. Los 10 tests siguen verdes. `MIGRATION.md` documenta cómo seguir.

---

# FUNCIÓN A5 — Licencia MIT y saneo de documentación

> **ESTADO REAL (2026-07-26): ⏳ SIN INICIAR / SIN VERIFICAR.** No se ha confirmado si existe `LICENSE` en la raíz. El README fue actualizado en algún momento pero nunca se auditó contra el comportamiento real del código — y ya se detectó al menos una contradicción histórica: el diagrama del README insinuaba una conexión del guardián de IA (B6) que no existe en el código. Al hacer A5, revisar ese diagrama.

## A5.0 Qué hace exactamente
- Coloca el archivo LICENSE con la licencia MIT.
- Sincroniza README y frontend para que no se contradigan (el caso de las keys era el síntoma).

## A5.1 Archivos

| Archivo | Nuevo o editar | Qué contiene |
|---|---|---|
| `LICENSE` | NUEVO | Texto MIT con tu nombre y el año. |
| `README.md` | EDITAR | Descripción real, stack real (FastAPI + React), los dos modos de keys, cómo levantar en local. |
| `BITACORA-plan-maestro.md` | (ya existe) | Referenciado desde el README. |

> **CORRECCIÓN DE STACK (2026-07-26):** el README debe decir el stack **real del momento**, no el aspiracional. Mientras A4 no esté hecha, el stack es FastAPI + JavaScript vanilla + SQLAlchemy + SQLite, no React. Prometer React en el README antes de tenerlo es exactamente la clase de contradicción que A5 vino a eliminar.

## A5.2 Texto de la licencia MIT (listo para pegar en LICENSE)

```
MIT License

Copyright (c) 2026 [TU NOMBRE COMPLETO]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Reemplaza `[TU NOMBRE COMPLETO]` por tu nombre real.

## A5.3 Prompt copy-paste

```
Lee el plan maestro y este documento.

Tarea: Función A5 — licencia y documentación.

PASO 0: confírmame con evidencia cruda si ya existe un archivo LICENSE en la raíz.

PASO 1: crea el archivo LICENSE en la raíz con el texto MIT exacto de la sección
A5.2, con mi nombre: [PONER NOMBRE] y el año 2026.

PASO 2: reescribe README.md para que refleje la realidad: qué es Bitácora (los tres
pilares), el stack REAL DE HOY (FastAPI + JavaScript vanilla + SQLAlchemy + SQLite
+ Docker — no React, mientras A4 no esté hecha), los dos modos de API keys, y las
instrucciones exactas para levantarlo en local. No prometas features que aún no existen.

PASO 3: revisa que README y el comportamiento del frontend no se contradigan en
ningún punto. Presta atención especial a cualquier diagrama de flujo que insinúe
conexiones entre módulos: verifica con grep que esas conexiones existan en el código.
Lístame cualquier contradicción que encuentres.

Actualiza 00-START-HERE.md al terminar.
```

## A5.4 Criterio de cierre
Existe LICENSE con MIT. README refleja la realidad y no contradice al código.

---

# FUNCIÓN A6 — Base de datos flexible (SQLite / PostgreSQL / MySQL)

> **ESTADO REAL (2026-07-26): ⏳ SIN INICIAR — y es un bloqueador para cerrar A3.**
> **Alembic está pinneado en `requirements.txt` pero NUNCA se inicializó:** no existe carpeta `alembic/`, ni `env.py`, ni `versions/`. La app usa `create_all()`.
>
> **ADVERTENCIA TÉCNICA para cuando se haga:** el proceso correcto NO es `alembic init` seguido de `autogenerate`. La base ya tiene tablas creadas por `create_all()`, así que autogenerate produciría una migración que intenta crear tablas existentes y fallaría. La secuencia correcta es:
> 1. `alembic init`
> 2. configurar `env.py` para que importe los modelos reales
> 3. `alembic stamp head` — marca el estado actual como línea base, sin ejecutar SQL
> 4. recién desde ahí, cada cambio nuevo se agrega como migración real
>
> Esto merece ser su propia tarea, no un paso escondido dentro de otra función.

## A6.0 Investigación (fundamento)
SQLAlchemy es una capa de abstracción (ORM) que habla con distintos motores de base de datos usando el mismo código Python. La conexión se define con una cadena `DATABASE_URL` (por ejemplo `sqlite:///bitacora.db`, `postgresql://user:pass@host/db`, `mysql://...`). Si el código evita SQL crudo específico de un motor y usa solo el ORM y migraciones con Alembic, el mismo código corre en cualquiera de los tres motores cambiando solo esa variable. Esto es lo que permite el despliegue en tres capas: SQLite para probar en local sin instalar nada, PostgreSQL para servidor serio.

## A6.1 Qué hace exactamente
- Centraliza la conexión a la base de datos en un solo lugar que lee `DATABASE_URL`.
- Elimina cualquier suposición de que la base es SQLite (SQL crudo, rutas de archivo hardcodeadas, tipos específicos de SQLite).
- Deja el docker-compose capaz de levantar con SQLite o con un contenedor PostgreSQL al lado.
- Documenta en el README cómo apuntar a cada motor.

## A6.2 Lenguaje y archivos

| Archivo | Lenguaje | Nuevo o editar | Qué contiene |
|---|---|---|---|
| `backend/database.py` | Python (SQLAlchemy) | EDITAR | Leer `DATABASE_URL` de entorno; default SQLite. Motor y sesión centralizados. |
| `backend/models.py` | Python | REVISAR | Confirmar que no hay tipos ni SQL atados a SQLite. |
| `backend/alembic.ini` + `migrations/` | Python (Alembic) | NUEVO/EDITAR | Migraciones que corran en los tres motores. |
| `backend/.env.example` | texto | EDITAR | Documentar `DATABASE_URL` para SQLite, PostgreSQL y MySQL. |
| `docker-compose.yml` | YAML | EDITAR | Perfil simple (SQLite) y perfil producción (con servicio PostgreSQL). |
| `docker-compose.postgres.yml` | YAML | NUEVO | Override que añade el contenedor PostgreSQL. |
| `tests/test_db_agnostic.py` | Python | NUEVO | Corre las operaciones básicas contra SQLite y contra PostgreSQL (en CI) para confirmar que no hay dependencia de motor. |

Total función A6: 3 nuevos, 4 editar/revisar.

> **AJUSTE DE RUTAS (2026-07-26):** los archivos reales están bajo `app/`, no `backend/`. Verificar la ubicación real de `database.py` y el modelo antes de editarlos.
>
> **DEPENDENCIA CRUZADA:** al cerrar A6, generar también la migración Alembic que A3 dejó pendiente. A3 no se marca como cerrada hasta entonces.

## A6.3 Diagrama de flujo

```
Variable de entorno DATABASE_URL
        │
   ┌────┼─────────────┬──────────────┐
   ▼                  ▼              ▼
sqlite:///…    postgresql://…   mysql://…
   │                  │              │
   └────────┬─────────┴──────────────┘
            ▼
   backend/database.py
   (un solo motor SQLAlchemy,
    lee la URL, crea sesión)
            │
            ▼
   models.py + Alembic
   (mismo código, sin SQL crudo
    específico de motor)
            │
            ▼
   test_db_agnostic.py corre las
   mismas operaciones en SQLite y
   PostgreSQL → ambas pasan
```

## A6.4 Prompt copy-paste

```
Lee el plan maestro, los mandamientos de construcción de este documento, y esta
sección. No asumas; pregúntame si dudas. No reescribas de cero.

Tarea: Función A6 — dejar la base de datos flexible (SQLite / PostgreSQL / MySQL).

PASO 1 (solo lectura): revisa el módulo de base de datos y el modelo, y dime si hay
algo atado específicamente a SQLite (SQL crudo, tipos propios de SQLite, rutas de
archivo hardcodeadas). Lístamelo con evidencia cruda y espera mi OK.

PASO 2 (tras OK): edita el módulo de base de datos para que lea DATABASE_URL de
variable de entorno, con default sqlite:///bitacora.db. Centraliza motor y sesión
ahí. Explícame el cambio antes de aplicarlo.

PASO 3: inicializa Alembic CORRECTAMENTE. La base ya tiene tablas creadas por
create_all(), así que NO uses autogenerate directo. Secuencia obligatoria:
  a) alembic init
  b) configurar env.py para importar los modelos reales
  c) alembic stamp head (marca el estado actual como línea base, sin ejecutar SQL)
  d) recién desde ahí, generar la migración pendiente de A3 (modelo Career)
Muéstrame cada paso antes de aplicarlo.

PASO 4: edita .env.example documentando DATABASE_URL para los tres motores. Edita
docker-compose.yml para un perfil simple (SQLite) y crea docker-compose.postgres.yml
como override con un servicio PostgreSQL.

PASO 5: crea tests/test_db_agnostic.py que corra las operaciones básicas (crear
carrera, fase, subtema) contra SQLite y, en CI, contra PostgreSQL. Ambas deben pasar.

Actualiza 00-START-HERE.md al terminar cada paso.
```

## A6.5 Criterio de cierre
El mismo código corre en SQLite (local) y PostgreSQL (producción) cambiando solo `DATABASE_URL`. El test agnóstico pasa en ambos. El docker-compose permite ambos despliegues.

---

# Orden de ejecución del Bloque A

Estrictamente en este orden, cada función cerrada y probada antes de la siguiente:

1. **A1** (keys) — es la deuda de seguridad que bloquea todo lo demás.
2. **A5** (licencia + README) — rápida, y deja el repo presentable.
3. **A6** (base de datos flexible) — antes de tocar el modelo de datos, para que A3 se construya ya agnóstico de motor.
4. **A2** (importador) — quita el riesgo legal del código.
5. **A3** (multi-carrera) — prepara el modelo para el motor (Bloque C), ya sobre base de datos flexible.
6. **A4** (React) — la migración, que se hace ahora que la base está limpia y antes de construir las 30 funciones nuevas.

**Nota 1:** A6 va antes que A3 a propósito. Si vas a tocar el modelo de datos en A3, conviene que la base ya sea agnóstica de motor, para no rehacer trabajo.

**Nota 2:** A4 (React) va al final del bloque a propósito. Primero se sanea la lógica (A1-A3, A6) sobre el frontend que ya funciona; luego se migra la capa visual. Así no mezclas dos cambios grandes al mismo tiempo.

> **DESVIACIÓN REAL DEL ORDEN (2026-07-26):** en la práctica se ejecutó **A3 primero, luego A2**, saltando A1, A5 y A6. Consecuencias concretas a tener presentes:
> - A3 quedó sin su migración Alembic (porque A6, que la habilita, no se hizo antes). A3 está funcionalmente hecha pero formalmente incompleta.
> - Cuando se haga A6, hay que revisar si el modelo que A3 tocó necesita ajustes para ser agnóstico de motor — exactamente el retrabajo que la Nota 1 quería evitar.
>
> **ORDEN SUGERIDO PARA LO QUE QUEDA:**
> 1. Terminar **A2** (está en curso, cerca de cerrar).
> 2. **A1** (deuda de seguridad, la más importante que queda).
> 3. **A6** (desbloquea la migración pendiente de A3).
> 4. Cerrar **A3** formalmente (migración Alembic + `test_multicareer.py`).
> 5. **A5** (rápida).
> 6. **A4** (la más grande; requiere confirmar primero que existan tests de Playwright verdes).

---

# Qué sigue después del Bloque A

Cuando el Bloque A esté cerrado y probado, el siguiente documento será **BITACORA-bloque-B-especificacion.md** (seguridad: escaneo automático, blindaje de datos externos, rate limiting), con el mismo nivel de detalle: investigación, archivos, lenguaje, diagrama de flujo y prompts.

Los documentos planeados, en orden:
- Bloque A — Sanear la base ← ESTE
- Bloque B — Seguridad nivel producción
- Bloque C — Motor de roadmaps (las tres vías)
- Bloque D — Recursos con Scrapling
- Bloque E — Práctica, video, bitácora
- Bloque F — Proveedores de IA y noticias
- Bloque G — GitHub y perfil
- Bloque H — Despliegue (local/servidor/internet)
- Bloque I — Lanzamiento a la comunidad
- Bloque J — Futuro (post-validación)

> **NOTA (2026-07-26):** Bloque B ya fue construido y auditado, fuera del orden original. Su estado real (qué quedó completo, qué diferido y por qué) está documentado en `00-START-HERE.md`. Bloque C está congelado hasta que Bloque A cierre por completo.