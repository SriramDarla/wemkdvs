from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent

app = FastAPI(
    title="Street Map API",
    description="Backend for the Street Map frontend",
    version="1.0.0",
)

# The frontend may be either:
#   1. A standalone file named "street-map 5.html" (or "street-map 5")
#   2. A folder named "street-map 5" containing index.html
#   3. A built frontend in "street-map 5/dist/index.html"
FRONTEND_FILE_CANDIDATES = [
    ROOT / "street-map 5.html",
    ROOT / "street-map 5",
]

FRONTEND_DIR_CANDIDATES = [
    ROOT / "street-map 5" / "dist",
    ROOT / "street-map 5",
    ROOT / "dist",
]

FRONTEND_FILE = next(
    (path for path in FRONTEND_FILE_CANDIDATES if path.is_file()),
    None,
)

FRONTEND_DIR = next(
    (
        path
        for path in FRONTEND_DIR_CANDIDATES
        if path.is_dir() and (path / "index.html").is_file()
    ),
    None,
)

# Mount available asset folders only when they exist.
# This avoids crashing at startup when a folder is absent.
STATIC_DIR = ROOT / "static"
if STATIC_DIR.is_dir():
    app.mount(
        "/static",
        StaticFiles(directory=str(STATIC_DIR)),
        name="static",
    )

if FRONTEND_DIR is not None:
    ASSETS_DIR = FRONTEND_DIR / "assets"
    if ASSETS_DIR.is_dir():
        app.mount(
            "/assets",
            StaticFiles(directory=str(ASSETS_DIR)),
            name="frontend-assets",
        )

    # Some plain HTML frontends keep CSS, JS, images, etc. beside index.html.
    # Serve those files under /frontend-files instead of exposing the whole project.
    app.mount(
        "/frontend-files",
        StaticFiles(directory=str(FRONTEND_DIR), html=False),
        name="frontend-files",
    )


@app.get("/health")
def health_check():
    """Simple endpoint to confirm that the backend is running."""
    return {"status": "ok"}


@app.get("/api")
def api_root():
    """Basic API information."""
    return {
        "message": "Street Map backend is running",
        "frontend_found": FRONTEND_FILE is not None or FRONTEND_DIR is not None,
    }


@app.get("/", include_in_schema=False)
def serve_frontend():
    """Serve the frontend homepage."""
    if FRONTEND_DIR is not None:
        return FileResponse(FRONTEND_DIR / "index.html")

    if FRONTEND_FILE is not None:
        return FileResponse(FRONTEND_FILE)

    expected = [
        str(ROOT / "street-map 5.html"),
        str(ROOT / "street-map 5"),
        str(ROOT / "street-map 5" / "dist" / "index.html"),
        str(ROOT / "dist" / "index.html"),
    ]
    raise HTTPException(
        status_code=404,
        detail=(
            "Frontend not found. Put the frontend file or folder beside app.py. "
            "Checked: " + " ; ".join(expected)
        ),
    )


# Add your project's API routes below this point.
# For example, a prediction endpoint can be added here once the model and
# expected input fields are known. This file intentionally does not invent
# model/API behavior that may not match your project.
