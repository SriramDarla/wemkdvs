from pathlib import Path
import json
import time
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
import joblib

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
MODELS_DIR = ROOT / "models"
DATA_DIR = ROOT / "data"
PUBLIC_DATA_DIR = ROOT / "street-map 5" / "public" / "data"

app = FastAPI(
    title="L-Town SCADA Leak Detection & Prioritization API",
    description="Backend inference engine for SCADA telemetry leak detection and network intervention prioritization.",
    version="2.0.0",
)

# Enable CORS for development with Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── MODEL & METADATA LOADER ──
RF_MODELS = None
MODEL_METADATA = None
FEATURE_SCHEMA = None
SCADA_PRESETS = None
BENCHMARK_CANDIDATES = None
NOMINAL_BASELINE = {}


def load_artifacts():
    global RF_MODELS, MODEL_METADATA, FEATURE_SCHEMA, SCADA_PRESETS, BENCHMARK_CANDIDATES, NOMINAL_BASELINE
    try:
        model_file = MODELS_DIR / "rf_models.joblib"
        if model_file.exists():
            RF_MODELS = joblib.load(model_file)

        meta_file = MODELS_DIR / "model_metadata.json"
        if meta_file.exists():
            with open(meta_file, "r", encoding="utf-8") as f:
                MODEL_METADATA = json.load(f)

        schema_file = MODELS_DIR / "feature_schema.json"
        if schema_file.exists():
            with open(schema_file, "r", encoding="utf-8") as f:
                FEATURE_SCHEMA = json.load(f)
                NOMINAL_BASELINE = {item["name"]: item.get("nominal_default", 0.0) for item in FEATURE_SCHEMA}

        presets_file = MODELS_DIR / "scada_presets.json"
        if presets_file.exists():
            with open(presets_file, "r", encoding="utf-8") as f:
                SCADA_PRESETS = json.load(f)

        # Load benchmark candidates reference
        bench_file = PUBLIC_DATA_DIR / "final_intervention_priorities.json"
        if not bench_file.exists():
            bench_file = DATA_DIR / "final_intervention_priorities.json"
        if bench_file.exists():
            with open(bench_file, "r", encoding="utf-8") as f:
                BENCHMARK_CANDIDATES = json.load(f)
    except Exception as exc:
        print(f"Warning: Could not load model artifacts on startup: {exc}")


load_artifacts()

# ── STATIC FRONTEND SERVING ──
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

STATIC_DIR = ROOT / "static"
if STATIC_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if FRONTEND_DIR is not None:
    ASSETS_DIR = FRONTEND_DIR / "assets"
    if ASSETS_DIR.is_dir():
        app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="frontend-assets")

    DATA_MOUNT = FRONTEND_DIR / "data"
    if DATA_MOUNT.is_dir():
        app.mount("/data", StaticFiles(directory=str(DATA_MOUNT)), name="frontend-data")

    app.mount(
        "/frontend-files",
        StaticFiles(directory=str(FRONTEND_DIR), html=False),
        name="frontend-files",
    )


# ── REQUEST SCHEMAS ──
class ScenarioParams(BaseModel):
    recovery_rate: float = Field(80.0, ge=10.0, le=100.0, description="Assumed recovery efficiency percentage (10-100%)")
    max_budget: float = Field(1000000.0, ge=100000.0, le=2000000.0, description="Maximum individual pipe repair budget limit in INR")
    minimum_loss: float = Field(0.10, ge=0.0, le=0.50, description="Minimum predicted loss threshold in ML/day")


class TelemetryInferenceRequest(BaseModel):
    timestamp: Optional[str] = Field("2019-12-31T23:55:00", description="SCADA reading ISO timestamp")
    flows: Optional[Dict[str, float]] = Field(None, description="Flow sensor readings in m3/h (e.g. p227, p235, PUMP_1)")
    pressures: Optional[Dict[str, float]] = Field(None, description="Node pressure head readings in meters (e.g. n1, n4, n769)")
    hour: Optional[int] = Field(None, ge=0, le=23, description="Hour of day (0-23)")
    day_of_week: Optional[int] = Field(None, ge=0, le=6, description="Day of week (0=Mon, 6=Sun)")
    month: Optional[int] = Field(None, ge=1, le=12, description="Month of year (1-12)")
    scenario_params: Optional[ScenarioParams] = Field(None, description="Scenario filter and recovery parameters")


# ── API ENDPOINTS ──
@app.get("/health")
def health_check():
    """Health check endpoint confirming API availability and model readiness."""
    return {
        "status": "ok",
        "model_loaded": RF_MODELS is not None,
        "models_count": len(RF_MODELS) if RF_MODELS else 0,
        "features_count": len(MODEL_METADATA.get("feature_columns", [])) if MODEL_METADATA else 0,
        "service": "L-Town Leak Detection & SCADA Inference API",
    }


@app.get("/api")
def api_root():
    """Basic API discovery endpoint."""
    return {
        "message": "L-Town Leak Detection & SCADA Inference API operational",
        "frontend_found": FRONTEND_FILE is not None or FRONTEND_DIR is not None,
        "endpoints": {
            "health": "/health",
            "model_info": "/api/model/info",
            "scada_presets": "/api/scada/presets",
            "predict_ltown": "/api/predict/ltown",
        },
    }


@app.get("/api/model/info")
def get_model_info():
    """Returns model metadata, feature requirements, and scientific integrity notices."""
    if not MODEL_METADATA:
        raise HTTPException(status_code=503, detail="Model metadata not loaded. Run artifact export script.")
    return {
        "model_name": MODEL_METADATA.get("model_name"),
        "training_date": MODEL_METADATA.get("training_date"),
        "num_models": MODEL_METADATA.get("num_models"),
        "features_count": MODEL_METADATA.get("features_count"),
        "feature_columns": MODEL_METADATA.get("feature_columns"),
        "flow_sensors": MODEL_METADATA.get("flow_sensors"),
        "pressure_sensors": MODEL_METADATA.get("pressure_sensors"),
        "time_features": MODEL_METADATA.get("time_features"),
        "training_samples": MODEL_METADATA.get("training_samples"),
        "test_split": MODEL_METADATA.get("test_split_description"),
        "scientific_integrity_notice": MODEL_METADATA.get("scientific_integrity_notice"),
        "eval_metrics": MODEL_METADATA.get("eval_metrics"),
        "feature_schema": FEATURE_SCHEMA,
    }


@app.get("/api/scada/presets")
def get_scada_presets():
    """Returns curated SCADA telemetry presets for interactive demonstration."""
    if not SCADA_PRESETS:
        # Fallback preset if file not found
        return [
            {
                "id": "benchmark_state",
                "name": "Benchmark State (2019-12-31)",
                "description": "Final timestamp of the L-Town 2019 dataset featuring active network anomalies.",
                "timestamp": "2019-12-31T23:55:00",
                "flows": {"p227": 118.42, "p235": 62.15, "PUMP_1": 96.30},
                "pressures": {"n1": 42.15, "n4": 39.80, "n769": 41.50, "n288": 38.90},
            }
        ]
    return SCADA_PRESETS


@app.post("/api/predict/ltown")
def predict_ltown_leakage(request: TelemetryInferenceRequest):
    """
    Executes real-time machine-learning inference for pipe leakage estimation
    using pure SCADA telemetry inputs (flows, pressures, and temporal context).
    Zero reliance on ground-truth leakage data.
    """
    if RF_MODELS is None or MODEL_METADATA is None:
        raise HTTPException(
            status_code=503,
            detail="Inference models not loaded on backend. Ensure models/rf_models.joblib exists.",
        )

    t_start = time.time()
    feature_columns = MODEL_METADATA.get("feature_columns", [])
    flow_sensors = MODEL_METADATA.get("flow_sensors", ["p227", "p235", "PUMP_1"])
    pressure_sensors = MODEL_METADATA.get("pressure_sensors", [])

    flows = request.flows or {}
    pressures = request.pressures or {}

    # Strict Validation: Check negative flows
    for k, val in flows.items():
        if val is None or np.isnan(val):
            raise HTTPException(status_code=400, detail=f"Flow value for {k} cannot be null or NaN.")
        if val < 0:
            raise HTTPException(status_code=400, detail=f"Physical flow measurement for {k} cannot be negative ({val} m3/h).")

    # Strict Validation: Check pressures in valid physical range (0 - 250 meters)
    for k, val in pressures.items():
        if val is None or np.isnan(val):
            raise HTTPException(status_code=400, detail=f"Pressure value for {k} cannot be null or NaN.")
        if val < 0 or val > 250:
            raise HTTPException(status_code=400, detail=f"Pressure reading for {k} is outside physical network bounds (0-250 m): {val} m.")

    # Time features deduction
    hour = request.hour
    day_of_week = request.day_of_week
    month = request.month

    if request.timestamp:
        try:
            ts = pd.to_datetime(request.timestamp)
            if hour is None:
                hour = int(ts.hour)
            if day_of_week is None:
                day_of_week = int(ts.dayofweek)
            if month is None:
                month = int(ts.month)
        except Exception:
            pass

    hour = 23 if hour is None else int(hour)
    day_of_week = 1 if day_of_week is None else int(day_of_week)
    month = 12 if month is None else int(month)

    # Impute missing sensors from nominal baseline
    imputed_sensors = []
    feature_dict = {}

    for col in flow_sensors:
        if col in flows:
            feature_dict[col] = float(flows[col])
        else:
            feature_dict[col] = float(NOMINAL_BASELINE.get(col, 100.0))
            imputed_sensors.append(col)

    for col in pressure_sensors:
        if col in pressures:
            feature_dict[col] = float(pressures[col])
        else:
            feature_dict[col] = float(NOMINAL_BASELINE.get(col, 42.0))
            imputed_sensors.append(col)

    feature_dict["hour"] = float(hour)
    feature_dict["day_of_week"] = float(day_of_week)
    feature_dict["month"] = float(month)

    # Construct input dataframe in exact feature order
    input_row = pd.DataFrame([[feature_dict[col] for col in feature_columns]], columns=feature_columns)

    # Scenario parameters
    scenario = request.scenario_params or ScenarioParams()
    recovery_rate = scenario.recovery_rate
    max_budget = scenario.max_budget
    minimum_loss = scenario.minimum_loss

    # Execute ML inference across candidate models
    benchmark_map = {}
    if BENCHMARK_CANDIDATES:
        for b in BENCHMARK_CANDIDATES:
            benchmark_map[b.get("Leak_Location", "")] = b

    candidate_results = []
    total_loss_ML = 0.0
    total_cost_INR = 0.0

    # Repair cost lookup for candidates
    SCENARIO_COSTS = {
        "p762": 1000000.0, "p426": 500000.0, "p721": 1000000.0, "p455": 200000.0,
        "p879": 500000.0,  "p331": 500000.0, "p193": 200000.0,  "p123": 500000.0,
        "p277": 200000.0,  "p810": 500000.0, "p257": 200000.0,  "p710": 500000.0,
        "p654": 200000.0,  "p680": 500000.0, "p280": 200000.0,  "p427": 200000.0,
    }

    # Connectivity lookup
    CONNECTIVITY = {
        "p762": {"start": "n683", "end": "n264", "region": 1},
        "p426": {"start": "n461", "end": "n462", "region": 1},
        "p721": {"start": "n655", "end": "n656", "region": 1},
        "p879": {"start": "n739", "end": "n740", "region": 1},
        "p331": {"start": "n376", "end": "n377", "region": 1},
        "p193": {"start": "n236", "end": "n237", "region": 1},
        "p123": {"start": "n151", "end": "n152", "region": 1},
        "p810": {"start": "n679", "end": "n680", "region": 1},
        "p710": {"start": "n648", "end": "n228", "region": 1},
        "p654": {"start": "n609", "end": "n610", "region": 1},
        "p427": {"start": "n462", "end": "n340", "region": 1},
        "p277": {"start": "n363", "end": "n19", "region": 3},
        "p257": {"start": "n350", "end": "n351", "region": 3},
        "p280": {"start": "n365", "end": "n23", "region": 3},
        "p455": {"start": "n480", "end": "n481", "region": 2},
        "p680": {"start": "n626", "end": "n233", "region": 4},
    }

    for pipe_id, model in RF_MODELS.items():
        if pipe_id not in CONNECTIVITY:
            continue

        raw_pred_m3h = float(model.predict(input_row)[0])
        raw_pred_m3h = max(0.0, raw_pred_m3h)
        loss_ML_day = round(raw_pred_m3h * 24.0 / 1000.0, 5)
        recov_ML_day = round(loss_ML_day * (recovery_rate / 100.0), 5)
        cost_INR = SCENARIO_COSTS.get(pipe_id, 200000.0)
        eff = round(recov_ML_day / (cost_INR / 100000.0), 5) if cost_INR > 0 else 0.0

        bench = benchmark_map.get(pipe_id, {})
        bench_loss = float(bench.get("Predicted_Loss_ML_per_day", loss_ML_day))
        delta_ML = round(loss_ML_day - bench_loss, 5)

        # Recommendation logic
        if loss_ML_day >= 0.28:
            rec = "Critical Water Loss"
        elif loss_ML_day >= 0.21:
            rec = "High Water Loss"
        elif eff >= 0.045 and loss_ML_day > 0:
            rec = "Cost Efficient"
        elif loss_ML_day > 0:
            rec = "Investigate"
        else:
            rec = "No Loss Detected"

        meta = CONNECTIVITY.get(pipe_id, {})

        candidate_results.append({
            "Pipe": pipe_id,
            "Leak_Location": pipe_id,
            "Network_Region": meta.get("region", 1),
            "Start_Node": meta.get("start", "—"),
            "End_Node": meta.get("end", "—"),
            "Predicted_Leakage_m3_h": round(raw_pred_m3h, 3),
            "Predicted_Loss_ML_per_day": loss_ML_day,
            "Recoverable_ML_per_day": recov_ML_day,
            "Repair_Cost_INR": cost_INR,
            "Recoverable_ML_per_1Lakh": eff,
            "Recommendation": rec,
            "Benchmark_Loss_ML_per_day": bench_loss,
            "Delta_vs_Benchmark_ML_per_day": delta_ML,
            "Model_Type": "RandomForestRegressor",
        })

    # Sort by predicted loss descending
    candidate_results.sort(key=lambda x: x["Predicted_Loss_ML_per_day"], reverse=True)

    # Filter according to scenario parameters
    filtered_candidates = [
        c for c in candidate_results
        if c["Predicted_Loss_ML_per_day"] >= minimum_loss and c["Repair_Cost_INR"] <= max_budget
    ]

    for c in filtered_candidates:
        total_loss_ML += c["Predicted_Loss_ML_per_day"]
        total_cost_INR += c["Repair_Cost_INR"]

    scenario_recovery_ML = total_loss_ML * (recovery_rate / 100.0)
    latency_ms = round((time.time() - t_start) * 1000.0, 2)

    return {
        "status": "success",
        "inference_type": "live_model_inference",
        "latency_ms": latency_ms,
        "timestamp": request.timestamp or "2019-12-31T23:55:00",
        "features_used_count": len(feature_columns),
        "imputed_sensors_count": len(imputed_sensors),
        "imputed_sensors": imputed_sensors[:5] if imputed_sensors else [],
        "total_candidates": len(candidate_results),
        "matching_candidates": len(filtered_candidates),
        "total_predicted_loss_ML_day": round(total_loss_ML, 4),
        "scenario_recovery_ML_day": round(scenario_recovery_ML, 4),
        "recovery_percent": recovery_rate,
        "total_repair_cost_INR": total_cost_INR,
        "candidates": filtered_candidates,
        "all_candidates": candidate_results,
        "scientific_notice": (
            "Live ML inference computed using 23 Random Forest Regressors on 39 SCADA telemetry features. "
            "Zero ground-truth leakage data is used during inference. Note: Models for late-onset burst pipes "
            "rely heavily on the seasonal month feature and may generalize poorly to sudden, previously unseen bursts. "
            "Field acoustic verification is required."
        ),
    }


# ── FRONTEND FALLBACK ROUTE ──
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
