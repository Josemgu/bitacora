# Bitacora - Learning OS

Diario de aprendizaje interactivo impulsado por IA para aprender cualquier rama de tecnologia mediante roadmaps interactivos, recursos oficiales, laboratorios, proyectos, planificacion inteligente y seguimiento personalizado.

## Instalacion rapida

```bash
git clone https://github.com/Josemgu/bitacora.git
cd bitacora
pip install -r requirements.txt
python run.py
# Abre http://localhost:8000 en tu navegador
```

## Stack

| Capa | Tecnologia |
|------|-----------|
| Backend | FastAPI (Python) |
| Base de datos | SQLite (archivo `.db` en `/data/`) |
| Frontend | HTML/CSS/JS vanilla (desde `static/`) |
| Comunicacion | `fetch()` del frontend contra `/api/*` |

## Estructura del proyecto

```
bitacora/
├── data/                    # Datos locales
│   ├── bitacora.db          # SQLite
│   ├── uploads/             # Archivos subidos
│   │   ├── roadmaps/
│   │   ├── recursos/
│   │   └── chat/
│   ├── exports/             # JSON exportados
│   └── logs/                # Logs de app y IA
├── app/                     # FastAPI backend
│   ├── main.py              # Punto de entrada
│   ├── database.py          # SQLAlchemy + SQLite
│   ├── schemas.py           # Pydantic schemas
│   ├── models/              # Modelos SQLAlchemy
│   ├── routers/             # Endpoints API
│   └── services/            # Logica de negocio + seed
├── static/                  # Frontend
│   ├── index.html           # App SPA
│   ├── css/styles.css       # Diseño visual
│   ├── js/                  # 19 modulos JS
│   └── data/seed.js         # Datos iniciales
├── requirements.txt
├── docker-compose.yml
├── .env.example
└── run.py                   # python run.py
```

## Funcionalidades

- **Roadmap interactivo** - 3 niveles: fases, temas, subtemas con checkboxes
- **Recursos CRUD** - Biblioteca con filtros, busqueda y categorias
- **Chat IA multi-proveedor** - OpenAI, Anthropic, Google, Ollama
- **Verificador de links** - Comprobacion automatica de enlaces rotos
- **Descubridor de recursos** - Busqueda inteligente por fase
- **Cola de aprobacion** - La IA propone, tu decides
- **Diagnostico de errores** - Panel de salud del sistema
- **Proyectos GitHub** - Checklist de requisitos por proyecto
- **Laboratorios** - 15 plataformas de practica
- **Tutoriales** - Contenido educativo filtrable
- **Centro de inteligencia** - Buzon estilo correo con alertas
- **Notas** - Editor markdown con auto-guardado
- **Perfil de usuario** - Configuracion personal
- **Tema oscuro/claro** - Toggle con selector de color

## Variables de entorno

Copia `.env.example` a `.env` y configura:

```env
# AI Provider API Keys (solo los que uses)
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# GOOGLE_API_KEY=...
```

## Licencia

MIT
