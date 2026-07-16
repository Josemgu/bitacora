from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def read_roadmaps():
    """Simple placeholder endpoint for roadmaps."""
    return {"roadmaps": []}
