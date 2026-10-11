#!/usr/bin/env python3
"""
AWS Elastic Beanstalk Deployment Packaging & Verification Script for BlueCore FastAPI Backend.

Packages the required backend code, configuration, metadata, and ML models into a
deployment-ready zip for the BlueCore-env Elastic Beanstalk environment.
Excludes node_modules, virtual environments, caches, raw CSV training data, and notebooks.
"""

import os
import sys
import zipfile
import tempfile
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEPLOY_DIR = ROOT / "deploy"
ZIP_OUTPUT_PATH = DEPLOY_DIR / "bluecore-backend-deployment.zip"

REQUIRED_FILES = [
    # Application & Platform entrypoints
    "app.py",
    "application.py",
    "Procfile",
    "requirements.txt",
    ".ebextensions/health.config",

    # Machine Learning Models and Artifacts
    "models/rf_models.joblib",
    "models/model_metadata.json",
    "models/feature_schema.json",
    "models/scada_presets.json",

    # Runtime Topology & Reference Data
    "data/final_intervention_priorities.json",
    "data/candidate_pipe_locations.json",
    "data/network_topology.json",
    "data/node_directory.json",
    "data/node_search_data.json",
]

FORBIDDEN_SUBSTRINGS = [
    "node_modules",
    ".DS_Store",
    "__pycache__",
    ".git",
    ".env",
    ".venv",
    ".csv",
    ".ipynb",
]


def create_deployment_zip():
    print(f"Creating Elastic Beanstalk deployment ZIP at:\n  {ZIP_OUTPUT_PATH}")
    DEPLOY_DIR.mkdir(parents=True, exist_ok=True)

    # Validate all required files exist before zipping
    missing_files = []
    for rel_path in REQUIRED_FILES:
        full_path = ROOT / rel_path
        if not full_path.exists():
            missing_files.append(rel_path)

    if missing_files:
        print(f"ERROR: Cannot create package. Missing required files: {missing_files}", file=sys.stderr)
        sys.exit(1)

    # Build the zip file
    with zipfile.ZipFile(ZIP_OUTPUT_PATH, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for rel_path in REQUIRED_FILES:
            full_path = ROOT / rel_path
            # Check for forbidden substrings
            for forbidden in FORBIDDEN_SUBSTRINGS:
                if forbidden in rel_path:
                    print(f"ERROR: Forbidden content detected: {rel_path}", file=sys.stderr)
                    sys.exit(1)

            # Preserve standard unix permissions (0o644 for regular files)
            zinfo = zipfile.ZipInfo.from_file(full_path, arcname=rel_path)
            zinfo.compress_type = zipfile.ZIP_DEFLATED
            zinfo.external_attr = 0o644 << 16  # standard file permissions
            with open(full_path, "rb") as f:
                zf.writestr(zinfo, f.read())

    print(f"Deployment ZIP created successfully. Size: {ZIP_OUTPUT_PATH.stat().st_size / (1024 * 1024):.2f} MB")


def inspect_and_verify_zip():
    print("\n--- Inspecting Deployment ZIP Structure ---")
    with zipfile.ZipFile(ZIP_OUTPUT_PATH, "r") as zf:
        infolist = zf.infolist()
        total_uncompressed = 0
        total_compressed = 0
        print(f"{'Filename':<45} {'Uncompressed':<15} {'Compressed':<15} {'Ratio'}")
        print("-" * 85)
        for info in infolist:
            total_uncompressed += info.file_size
            total_compressed += info.compress_size
            ratio = (1.0 - (info.compress_size / info.file_size)) * 100 if info.file_size > 0 else 0
            print(f"{info.filename:<45} {info.file_size:<15} {info.compress_size:<15} {ratio:.1f}%")

            # Check that no forbidden file slipped in
            for forbidden in FORBIDDEN_SUBSTRINGS:
                if forbidden in info.filename:
                    raise ValueError(f"Prohibited file found in zip: {info.filename}")

        print("-" * 85)
        print(f"Total entries: {len(infolist)}")
        print(f"Total uncompressed size: {total_uncompressed / (1024 * 1024):.2f} MB")
        print(f"Total compressed size:   {total_compressed / (1024 * 1024):.2f} MB")


def simulate_extracted_deployment():
    print("\n--- Simulating Clean Deployment in Sandbox ---")
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        with zipfile.ZipFile(ZIP_OUTPUT_PATH, "r") as zf:
            zf.extractall(temp_path)

        print(f"Extracted package to sandbox: {temp_path}")

        # Add sandbox to sys.path and test
        sys.path.insert(0, str(temp_path))
        try:
            # Test application import
            import importlib
            if "application" in sys.modules:
                del sys.modules["application"]
            if "app" in sys.modules:
                del sys.modules["app"]

            import application
            from fastapi.testclient import TestClient

            client = TestClient(application.app)

            # 1. Health check
            res_health = client.get("/health")
            assert res_health.status_code == 200, f"Health check failed: {res_health.text}"
            health_data = res_health.json()
            assert health_data.get("status") == "ok", "Health status not ok"
            assert health_data.get("model_loaded") is True, "Models not loaded"
            assert health_data.get("models_count") == 23, f"Expected 23 models, got {health_data.get('models_count')}"
            assert health_data.get("features_count") == 39, f"Expected 39 features, got {health_data.get('features_count')}"
            print(" [PASS] /health endpoint verified (23 models, 39 features)")

            # 2. Model info
            res_info = client.get("/api/model/info")
            assert res_info.status_code == 200, f"Model info failed: {res_info.text}"
            info_data = res_info.json()
            assert len(info_data.get("feature_columns", [])) == 39
            print(" [PASS] /api/model/info verified (39 feature columns)")

            # 3. SCADA presets
            res_presets = client.get("/api/scada/presets")
            assert res_presets.status_code == 200, f"Presets failed: {res_presets.text}"
            presets_data = res_presets.json()
            assert len(presets_data) >= 1
            print(f" [PASS] /api/scada/presets verified ({len(presets_data)} presets)")

            # 4. Standard prediction route: POST /api/predict/ltown
            mock_telemetry = {
                "telemetry": {
                    "p227": 118.42,
                    "p235": 62.15,
                    "n1": 24.5,
                    "n4": 28.1,
                },
                "scenario": {
                    "recovery_percent": 80.0,
                    "max_budget": 1000000.0,
                    "minimum_loss": 0.10,
                }
            }
            res_pred = client.post("/api/predict/ltown", json=mock_telemetry)
            assert res_pred.status_code == 200, f"Predict failed: {res_pred.text}"
            pred_data = res_pred.json()
            assert pred_data.get("status") == "success"
            assert len(pred_data.get("all_candidates", [])) == 16
            assert len(pred_data.get("candidates", [])) > 0
            print(f" [PASS] POST /api/predict/ltown verified (16 all_candidates, {len(pred_data.get('candidates'))} filtered)")

            # 5. Trailing slash prediction route: POST /api/predict/ltown/
            res_pred_slash = client.post("/api/predict/ltown/", json=mock_telemetry)
            assert res_pred_slash.status_code == 200, f"Trailing slash predict failed: {res_pred_slash.text}"
            print(" [PASS] POST /api/predict/ltown/ verified (HTTP 200 without redirect)")

            # 6. Rewritten root route: POST /
            res_pred_root = client.post("/", json=mock_telemetry)
            assert res_pred_root.status_code == 200, f"Root POST predict failed: {res_pred_root.text}"
            print(" [PASS] POST / (API Gateway path-strip compatibility) verified (HTTP 200)")

            print("\n ALL SANDBOX TESTS PASSED! Package is verified deployment-ready.")
        finally:
            if str(temp_path) in sys.path:
                sys.path.remove(str(temp_path))


if __name__ == "__main__":
    create_deployment_zip()
    inspect_and_verify_zip()
    simulate_extracted_deployment()
