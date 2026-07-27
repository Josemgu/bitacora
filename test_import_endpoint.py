"""
Script de verificacion del endpoint POST /api/roadmaps/import.
Ejecutar con: python test_import_endpoint.py
Requiere que la app este corriendo en http://localhost:8000
"""
import requests

BASE = "http://localhost:8000"

# -- Archivo de prueba --
# Conteo exacto:
#   Fase "Fundamentos":  ### Sintaxis (3 subtopics) + ### Funciones (3 subtopics) = 2 topics, 6 subtopics
#   Fase "Avanzado":     ### POO (3 subtopics) = 1 topic, 3 subtopics
#   Total: 2 fases, 3 topics, 9 subtopics, 1 resource (el link de Docs Python)
TEST_MD = b"""# Python Basico

## Fundamentos

### Sintaxis
- Variables y tipos
- Condicionales
- [Docs Python](https://docs.python.org/3/)

### Funciones
- Definicion
- Argumentos
- Retorno

## Avanzado

### POO
- Clases
- Herencia
- Polimorfismo
"""


def cleanup(career_id):
    """Borra la carrera de prueba si existe. Siempre ejecuta."""
    if career_id is None:
        return
    try:
        r = requests.delete(f"{BASE}/api/roadmaps/{career_id}")
        print(f"  Cleanup: DELETE id={career_id} -> {r.status_code}")
    except Exception as e:
        print(f"  Cleanup: fallo al borrar id={career_id}: {e}")


def main():
    career_id = None

    try:
        print("=" * 60)
        print("TEST 1: Subir archivo MD valido")
        print("=" * 60)

        files = {"file": ("test.md", TEST_MD, "text/markdown")}
        r = requests.post(f"{BASE}/api/roadmaps/import", files=files)
        print(f"Status: {r.status_code}")
        data = r.json()
        print(f"Response: {data}")

        assert r.status_code == 201, f"Esperaba 201, obtuve {r.status_code}: {data}"
        assert data["ok"] is True
        assert data["career_title"] == "Python Basico"
        assert data["phase_count"] == 2, f"phase_count: esperaba 2, obtuve {data['phase_count']}"
        assert data["topic_count"] == 3, f"topic_count: esperaba 3, obtuve {data['topic_count']}"
        assert data["subtopic_count"] == 9, f"subtopic_count: esperaba 9, obtuve {data['subtopic_count']}"
        assert data["resource_count"] == 1, f"resource_count: esperaba 1, obtuve {data['resource_count']}"

        career_id = data["career_id"]
        print(f"\nCarrera creada: id={career_id}, titulo='{data['career_title']}'")
        print(f"Fases: {data['phase_count']}, Topics: {data['topic_count']}, "
              f"Subtopics: {data['subtopic_count']}, Recursos: {data['resource_count']}")
        if data.get("warnings"):
            print(f"Warnings: {data['warnings']}")

        print("\n" + "=" * 60)
        print("TEST 2: Verificar que is_active=False")
        print("=" * 60)

        # GET /api/roadmaps/ devuelve la carrera ACTIVA (is_active=True).
        # Si la carrera importada apareciera como activa, algo esta mal.
        r = requests.get(f"{BASE}/api/roadmaps/")
        active = r.json()
        assert active["id"] != career_id, (
            f"La carrera importada (id={career_id}) aparece como activa. "
            f"Deberia tener is_active=False."
        )
        print(f"OK: carrera activa es id={active['id']}, la importada (id={career_id}) no es activa")

        print("\n" + "=" * 60)
        print("TEST 3: Verificar fases de la carrera importada")
        print("=" * 60)

        # GET /api/roadmaps/phases solo devuelve fases de la carrera ACTIVA.
        # Para verificar las fases de la carrera importada, la activamos
        # temporalmente, verificamos, y la desactivamos.
        # PATCH /{roadmap_id} usa query params, no JSON body.
        r = requests.patch(
            f"{BASE}/api/roadmaps/{career_id}",
            params={"is_active": True},
        )
        assert r.status_code == 200, f"No pude activar la carrera: {r.status_code} {r.text}"

        r = requests.get(f"{BASE}/api/roadmaps/phases")
        phases = r.json()
        imported_phases = [p for p in phases if p["career_id"] == career_id]
        imported_phases.sort(key=lambda p: p["index"])

        print(f"Fases encontradas: {len(imported_phases)}")
        for p in imported_phases:
            print(f"  [{p['index']}] '{p['title']}' accent={p['accent']}")

        assert len(imported_phases) == 2
        assert imported_phases[0]["title"] == "Fundamentos"
        assert imported_phases[1]["title"] == "Avanzado"
        # Accent palette: ["#3fb950", "#58a6ff", "#d29922", "#bc8cff", "#f78166"]
        assert imported_phases[0]["accent"] == "#3fb950"
        assert imported_phases[1]["accent"] == "#58a6ff"
        print("OK: fases y accents verificados")

        # Desactivar la carrera importada, reactivar la original
        requests.patch(f"{BASE}/api/roadmaps/{career_id}", params={"is_active": False})

        print("\n" + "=" * 60)
        print("TEST 4: Formato invalido -> 400")
        print("=" * 60)

        files = {"file": ("invalid.txt", b"esto no es un roadmap", "text/plain")}
        r = requests.post(f"{BASE}/api/roadmaps/import", files=files)
        print(f"Status: {r.status_code}")
        print(f"Response: {r.json()}")
        assert r.status_code == 400, f"Esperaba 400, obtuve {r.status_code}"
        print("OK: rechazado correctamente")

        print("\n" + "=" * 60)
        print("TEST 5: MD sin H1 -> 400")
        print("=" * 60)

        bad_md = b"## Fase sin titulo\n### Topic\n- item"
        files = {"file": ("sin-h1.md", bad_md, "text/markdown")}
        r = requests.post(f"{BASE}/api/roadmaps/import", files=files)
        print(f"Status: {r.status_code}")
        print(f"Response: {r.json()}")
        assert r.status_code == 400
        print("OK: rechazado correctamente")

        print("\n" + "=" * 60)
        print("TODOS LOS TESTS PASARON")
        print("=" * 60)

    finally:
        print("\n" + "=" * 60)
        print("CLEANUP")
        print("=" * 60)
        cleanup(career_id)


if __name__ == "__main__":
    main()
