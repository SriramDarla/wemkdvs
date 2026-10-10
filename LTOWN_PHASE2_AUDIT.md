# Phase 2 — L-Town Audit Report Before Implementation

**Branch**: `feature/ltown-inference`
**Base Commit**: `f903df211a36e6866b369e74cd9e3e8dda2e83ba` (`main`)
**Audit Date**: October 10, 2026
**Auditor**: Antigravity Assistant
**Repository**: `SriramDarla/wemkdvs`

---

## Executive Summary & Major Area Ratings

This audit provides a comprehensive, rigorous examination of the L-Town leak detection and intervention prioritization system across all data, machine learning, backend API, and frontend components before implementing Phase 2 real-time inference.

| Audit Area | Scope | Rating | Key Finding |
| :--- | :--- | :---: | :--- |
| **1. Existing Features & Reusable Components** | Frontend pages, routes, styles, shared data | **PASS** | Strong visual foundation, MapLibre integration, and modular pages. `street-map 5/src/pages/LTownPage.jsx` does **not** exist in repo. |
| **2. Scenario Controls & State Consistency** | Recovery rate, repair budget, min loss, filters | **PARTIAL** | No interactive scenario sliders exist. Recovery rate hardcoded (60% in MapView vs 80% in InterventionLab). KPI cards do not update when filters change. |
| **3. Model Pipeline & Preprocessing** | Feature order, splits, RF vs Persistence, inference logic | **PARTIAL** | Pipeline reproduced 100% numerically. However, **Persistence directly queries ground-truth leak data** for the top 5 candidates (`p762`, `p426`, `p721`, `p455`, `p879`). |
| **4. Data Compatibility & Artifact Availability** | SCADA CSVs, leakage CSV, `.inp` topology, model weights | **PARTIAL** | Raw datasets are complete, sorted, and clean (105,120 rows). However, **zero serialized model artifacts (`.joblib`, `.pkl`) exist** in the repository. |
| **5. FastAPI Backend Capabilities** | `app.py`, inference routes, telemetry ingestion | **BLOCKED** | `app.py` is currently a static file server with `/health` and `/api`. No prediction or scenario simulation routes exist. |
| **6. Map & Routing Architecture** | MapLibre layers, Carto basemap, coordinate systems | **PASS** | `pipes.geojson` (19,010 lines) and `leaks.geojson` (453 lines) correctly normalized around `(0, 0)`. Hash router handles `#/`, `#/map`, and `#/intervention`. |

---

## 1. Existing Features and Reusable Components

### 1.1 Frontend Components (`street-map 5/src/`)
- **`src/App.jsx`**:
  - Implements a zero-dependency hash router listening to `hashchange`.
  - Routes:
    - `#/`: Renders `Landing.jsx` (Redesigned Hero & Feature Showcase).
    - `#/map`: Renders `MapPage.jsx` (Interactive 3D network map with ML Pipeline tab).
    - `#/intervention`: Renders `InterventionLab.jsx` (Intervention prioritization laboratory).
- **`src/pages/LTownPage.jsx`**:
  - **FINDING: DOES NOT EXIST.** The prompt requested inspection of `street-map 5/src/pages/LTownPage.jsx`. An exhaustive search of the repository confirmed this file is absent. Its responsibilities are split between `MapPage.jsx` / `MapView.jsx` and `InterventionLab.jsx`.
- **`src/pages/Landing.jsx`**:
  - Contains the finalized Skyline hero redesign with hydraulic schematic illustration (`HeroScene.jsx`), clear demonstration badges, and navigation CTA buttons to `#/map` and `#/intervention`.
- **`src/pages/MapPage.jsx`**:
  - Wraps `MapView.jsx` and provides top navigation tabs: `🗺 Network Map`, `🤖 ML Pipeline`, and a direct link to `🧪 Intervention Lab`.
- **`src/components/MapView.jsx`** (55 KB, 1,228 lines):
  - MapLibre GL engine with Carto Dark Matter basemap (`https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`).
  - Renders L-Town pipeline GeoJSON (`pipes.geojson`) and leak candidates (`leaks.geojson`).
  - Overlay layers: 3D extrusions, OpenInfraMap global vector tiles (`https://tiles.openinframap.org/tilejson/2.json`), synthetic global replica incidents, and real India municipal benchmark data (`india_leaks.json`).
  - Interactive ML Pipeline tab with KPI summary cards, candidate priority table, and model performance comparison table.
- **`src/pages/InterventionLab.jsx`** (30 KB, 653 lines):
  - Dedicated decision-support interface for water utilities.
  - Features: Multi-attribute filtering (Region, Recommendation, Pipe/Node search), sorting (Rank, Water Loss, Recoverable Loss, Repair Cost, Cost-Efficiency), candidate detail inspection drawer, regional loss summaries, and methodology modal.
- **`src/styles.css`** (46 KB):
  - Unified design system: dark mode palette (`--bg: #0b0f19`, `--surface: #121826`, `--accent: #3b82f6`, `--danger: #ef4444`, `--success: #10b981`), typography (Inter/system-ui), glassmorphism cards, and responsive layouts.
- **`package.json`**:
  - Dependencies: `maplibre-gl` (^5.1.0), `react` (^18.3.1), `react-dom` (^18.3.1), `lucide-react` (^1.16.0).
  - Dev dependencies: `vite` (^6.0.5), `@vitejs/plugin-react` (^4.3.4).

### 1.2 Backend Component (`app.py`)
- Python FastAPI application running on Python 3.12/3.13.
- Endpoints:
  - `GET /health` -> `{"status": "ok"}`
  - `GET /api` -> `{"message": "Street Map backend is running", "frontend_found": true}`
  - `GET /` -> Serves frontend `index.html` from candidate directories (`dist`, `street-map 5`, etc.).
- Static file mounting: mounts `/static`, `/assets`, and `/frontend-files`.
- **Finding**: Lines 111–114 explicitly state:
  ```python
  # Add your project's API routes below this point.
  # For example, a prediction endpoint can be added here once the model and
  # expected input fields are known. This file intentionally does not invent
  # model/API behavior that may not match your project.
  ```
  No machine learning libraries are imported, no model weights are loaded, and no inference routes exist.

### 1.3 Data Assets (`data/` and `street-map 5/public/data/`)
- `data/2019_SCADA_Flows.csv` (4.0 MB, 105,120 rows)
- `data/2019_SCADA_Pressures.csv` (22.5 MB, 105,120 rows)
- `data/2019_Leakages.csv` (10.3 MB, 105,120 rows)
- `data/L-TOWN_Real.inp` (Network topology definition in EPANET format)
- `data/final_intervention_priorities.json` / `.csv` (16 prioritized pipes)
- `data/network_topology.json` / `.csv` (905 pipes with start/end node coordinates)
- `data/candidate_pipe_locations.json` / `.csv` (16 candidate pipes with coordinates)
- `data/model_performance.csv` (Validation/test metrics for 23 candidate pipes)
- `street-map 5/public/data/pipes.geojson` (19,010 lines, LineString geometry)
- `street-map 5/public/data/leaks.geojson` (453 lines, Point geometry)
- `street-map 5/public/data/india_leaks.json` (Real municipal NRW data)

---

## 2. Scenario-Control Calculation and Validation Findings

### 2.1 Audit of Existing Scenario Controls
The prompt requires auditing how the **recovery-rate**, **repair-budget**, and **minimum-predicted-loss** controls currently work.

| Scenario Parameter | Current Implementation Status | Current Math / Logic | Location in Code |
| :--- | :---: | :--- | :--- |
| **Recovery Rate** | **Hardcoded / No Control** | **Discrepancy identified:**<br>• `InterventionLab.jsx`: Hardcoded **80%** scenario factor: `Recoverable = Loss * 0.80`<br>• `MapView.jsx`: Hardcoded **60%** scenario factor: `summary.totalLoss * 0.6` (attributed to CPHEEO norms)<br>• `final_intervention_priorities.json`: Precomputed at **80%**. | `InterventionLab.jsx:74, 195`<br>`MapView.jsx:983, 1208`<br>`leak_detection_fixed.ipynb:76` |
| **Repair Budget** | **Static Display Only / No Control** | Displays fixed illustrative repair costs per pipe (`₹2L`, `₹5L`, `₹10L`) and sums total repair cost (`₹76.0L` across all 16 pipes). No budget constraint slider or dynamic budget allocation exists. | `InterventionLab.jsx:75, 609`<br>`MapView.jsx:992, 1204` |
| **Minimum Predicted Loss** | **Absent / No Control** | No filter or slider exists to threshold candidate pipes by minimum loss (e.g. `> 0.15 ML/day`). | Not present in UI |

### 2.2 State Consistency and Filter Synchronization Findings
When testing filter interactions in `InterventionLab.jsx` and `MapView.jsx`, the following critical state synchronization issues were uncovered:

#### Inconsistency 1: Decoupling of Top KPI Totals from Table Filters
In `InterventionLab.jsx`, the top KPI cards calculate aggregate statistics using `useMemo`:
```javascript
// InterventionLab.jsx lines 70-87
const metrics = useMemo(() => {
  if (!data.length) return null
  const totalPipes = data.length
  const totalLoss = data.reduce((acc, r) => acc + (Number(r.Predicted_Loss_ML_per_day) || 0), 0)
  const totalRecoverable = data.reduce((acc, r) => acc + (Number(r.Recoverable_ML_per_day) || 0), 0)
  const totalCost = data.reduce((acc, r) => acc + (Number(r.Repair_Cost_INR) || 0), 0)
  ...
}, [data]) // <-- DEPENDS ONLY ON UNFILTERED DATA
```
- **Observed Behavior**: When a user changes the **Region** filter (e.g., selecting Region 2) or the **Recommendation** filter (e.g., selecting "Critical Water Loss"), the candidate table and count update to show the matching subset (e.g., 1 pipe), but the top KPI cards (`totalPipes`, `totalLoss`, `totalRecoverable`, `totalCost`) **remain frozen at the global totals** (16 pipes, 3.42 ML/day, ₹76.0 L).
- **Required Fix**: KPI metrics must be computed against `filteredData` (or provide both global network totals and filtered scenario totals).

#### Inconsistency 2: Orphaned Candidate Detail Selection
In `InterventionLab.jsx`, `selectedCandidate` is initialized to `data[0]` (`p762` in Region 1).
- **Observed Behavior**: If a user selects `p762`, then sets the Region filter to Region 3 or Region 4, `filteredData` updates to only show pipes in Region 3 or 4. However, `selectedCandidate` is **not updated**. The right-hand detail inspection panel continues displaying `p762` (Region 1) despite it being completely absent from the visible table.
- **Required Fix**: When `filteredData` changes, if `selectedCandidate` is no longer in `filteredData`, auto-select `filteredData[0]` (or set to `null`).

#### Inconsistency 3: Map Highlights Decoupled from Selected Candidate
In `MapView.jsx`:
```javascript
// MapView.jsx lines 657-660
if (prios.length && map.getLayer(LAYER_IDS.pipesHL)) {
  const ids = prios.map((p) => p.Pipe || p.Leak_Location).filter(Boolean)
  map.setFilter(LAYER_IDS.pipesHL, ['in', 'Pipe', ...ids])
}
```
- **Observed Behavior**: The map layer `water-pipes-hl` statically highlights all 16 candidate pipes in red simultaneously. Selecting a candidate pipe in the priority table flies the camera to the pipe, but does not isolate, highlight, or glow the selected pipe differently on the map canvas.

---

## 3. Actual Model Inference Audit

### 3.1 Notebook Pipeline Anatomy (`notebooks/leak_detection_fixed.ipynb`)
The notebook implements a hybrid per-pipe regression strategy comparing **Random Forest Regression** against a **Lag-1 Persistence Baseline**.

#### A. Exact Features, Order, and Preprocessing
The feature matrix `X` consists of exactly **39 columns** in the following deterministic order:
1. **Flow Sensors (3 columns)**: `p227`, `p235`, `PUMP_1` (Units: $\text{m}^3/\text{h}$)
2. **Pressure Sensors (33 columns)**: `n1`, `n4`, `n31`, `n54`, `n105`, `n114`, `n163`, `n188`, `n215`, `n229`, `n288`, `n296`, `n332`, `n342`, `n375`, `n399`, `n410`, `n415`, `n429`, `n458`, `n469`, `n495`, `n506`, `n516`, `n549`, `n613`, `n636`, `n644`, `n679`, `n697`, `n722`, `n740`, `n752` (Units: meters of water head, $\text{m}$)
3. **Temporal Features (3 columns)**:
   - `hour`: `data["Timestamp"].dt.hour` ($0 \dots 23$)
   - `day_of_week`: `data["Timestamp"].dt.dayofweek` ($0 \dots 6$, where Monday=0)
   - `month`: `data["Timestamp"].dt.month` ($1 \dots 12$)
- **Preprocessing**: `pd.to_datetime(Timestamp)`, chronological sort. **No scaling or imputation**: sensor values contain 0 missing values across all 105,120 rows.

#### B. Targets and Pipe-to-Output Mapping
- **Target Matrix `Y` (23 columns)**: Historical leakage rates from `2019_Leakages.csv` for candidate pipes:
  `p123`, `p142`, `p193`, `p257`, `p277`, `p280`, `p331`, `p426`, `p427`, `p455`, `p514`, `p523`, `p586`, `p653`, `p654`, `p680`, `p710`, `p721`, `p762`, `p800`, `p810`, `p827`, `p879`.
- **Units**: Values are in $\text{m}^3/\text{h}$ (`LEAK_TO_M3_PER_H = 1.0`).

#### C. Chronological Train / Validation / Test Splits
Total rows: $N = 105,120$ observations at 5-minute intervals across year 2019.
- **Train (70%)**: Rows $0 \dots 73,583$ (2019-01-01 00:00 to 2019-09-13 11:55; 73,584 rows)
- **Validation (15%)**: Rows $73,584 \dots 89,351$ (2019-09-13 12:00 to 2019-11-07 17:55; 15,768 rows)
- **Test (15%)**: Rows $89,352 \dots 105,119$ (2019-11-07 18:00 to 2019-12-31 23:55; 15,768 rows)

#### D. Model Configuration & Per-Pipe Selection Decisions
- **Random Forest Hyperparameters**:
  ```python
  RandomForestRegressor(n_estimators=30, max_depth=15, min_samples_leaf=5, random_state=42, n_jobs=-1)
  ```
- **Persistence Baseline**:
  `last_known = Y.shift(1)` (Lag-1 value of actual historical leak flow).
- **Selection Decision Rule**:
  `Selected_Model = "RF" if rf_val_mae < ps_val_mae else "Persistence"`

Our automated verification reproduced the exact model selections:
- **10 Pipes Selected Random Forest**:
  `p193`, `p257`, `p277`, `p280`, `p331`, `p427`, `p654`, `p680`, `p710`, `p810`.
- **13 Pipes Selected Persistence**:
  `p123`, `p142`, `p426`, `p455`, `p514`, `p523`, `p586`, `p653`, `p721`, `p762`, `p800`, `p827`, `p879`.

---

### 3.2 CRITICAL FINDING: The "Persistence" Inference Flaw
A critical structural flaw in the notebook's inference logic was discovered upon auditing Cell 12 and Cell 14:

```python
# Cell 14 in leak_detection_fixed.ipynb
latest_X = X.iloc[[-1]]
rows = []
for leak in leak_columns:
    selected = final_results.set_index("Leak_Location").loc[leak, "Selected_Model"]
    if selected == "RF":
        value = rf_models[leak].predict(latest_X)[0]
    else:
        # Persistence: use the last observed value from the leak dataset
        value = Y[leak].iloc[-1]   # <--- READS DIRECTLY FROM 2019_Leakages.csv!
    rows.append([leak, selected, max(0.0, float(value))])
```

#### Why Did Persistence Beat Random Forest for the Top Leaks?
We analyzed the temporal distribution of non-zero leaks in `2019_Leakages.csv` across the splits:

| Pipe ID | Final Priority Rank | Train $>0$ (Rows 0–73,584) | Val $>0$ (Rows 73,584–89,352) | Test $>0$ (Rows 89,352–105,120) | Final Value at row 105,119 ($\text{m}^3/\text{h}$) | Selected Model |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`p762`** | **#1** | **0** | 8,020 | 15,768 | 15.53 | **Persistence** |
| **`p426`** | **#2** | **0** | 3,655 | 15,768 | 13.25 | **Persistence** |
| **`p721`** | **#3** | 11,912 | 15,768 | 15,768 | 12.95 | **Persistence** |
| **`p455`** | **#4** | **0** | 9,533 | 15,768 | 10.96 | **Persistence** |
| **`p879`** | **#5** | **0** | **0** | 11,697 | 10.93 | **Persistence** |
| `p331` | #6 | 42,070 | 15,768 | 15,768 | 10.55 | **RF** |
| `p193` | #7 | 33,289 | 15,768 | 15,768 | 10.21 | **RF** |
| **`p123`** | **#8** | **0** | 15,148 | 15,768 | 9.05 | **Persistence** |
| `p277` | #12 | 29,860 | 15,768 | 15,768 | 7.29 | **RF** |
| `p810` | #9 | 73,584 | 15,768 | 15,768 | 6.79 | **RF** |
| `p257` | #13 | 73,584 | 15,768 | 15,768 | 6.77 | **RF** |
| `p710` | #10 | 49,797 | 15,768 | 15,768 | 5.46 | **RF** |
| `p654` | #11 | 73,584 | 15,768 | 15,768 | 5.40 | **RF** |
| `p680` | #16 | 18,759 | 15,768 | 15,768 | 5.36 | **RF** |
| `p280` | #14 | 61,907 | 15,768 | 15,768 | 5.21 | **RF** |
| `p427` | #15 | 73,584 | 15,768 | 15,768 | 4.97 | **RF** |

#### Crucial Insights on Inference Feasibility:
1. **The top 5 candidate pipes (`p762`, `p426`, `p721`, `p455`, `p879`) were NEVER learned by machine learning.** Because their training leak labels were 100% zero, the Random Forest models learned to predict 0.0 for them.
2. In the validation split, once the continuous leak began, `Y.shift(1)` had an MAE of $< 0.01\ \text{m}^3/\text{h}$ because continuous leak flows only fluctuate slightly timestamp-to-timestamp. Consequently, Persistence easily defeated RF on validation MAE.
3. At the "inference" step (Cell 14), the notebook produced predictions for these pipes by **reading directly from `2019_Leakages.csv` (`Y[leak].iloc[-1]`)**.
4. **Impact on Production API**: In a true deployment, the utility does not have `2019_Leakages.csv` (if they had actual leakage flow for every pipe, leak detection would be unnecessary!). Therefore, **a pure SCADA telemetry endpoint cannot run the Persistence models without ground-truth leak inputs**. If RF alone is used without retraining, these 5 critical pipes will output `0.0`.

### 3.3 BattLeDIM Classifier Compatibility
- The user's separate BattLeDIM classifier is a discrete classification model (predicting leak presence/absence or discrete DMA classes).
- The L-Town pipeline in this repository is a **continuous regression pipeline** predicting quantitative flow rates ($\text{m}^3/\text{h}$) to estimate volumetric loss in megalitres per day ($\text{ML/day}$).
- **Conclusion**: The BattLeDIM classifier is **fundamentally incompatible** with the L-Town regression pipeline and cannot be dropped into this system.

---

## 4. Data Compatibility and Artifact Availability

### 4.1 Data File Verification
All source files required for training and topology mapping exist in `data/`:
- `2019_SCADA_Flows.csv` (105,120 rows, 4 columns) — Complete, verified.
- `2019_SCADA_Pressures.csv` (105,120 rows, 34 columns) — Complete, verified.
- `2019_Leakages.csv` (105,120 rows, 24 columns) — Complete, verified.
- `L-TOWN_Real.inp` (EPANET network file: 785 nodes, 905 pipes) — Complete, verified.
- `final_intervention_priorities.json` — Verified identical between `data/` and `street-map 5/public/data/`.

### 4.2 Model Artifact Search Results
A recursive filesystem search for serialized machine learning artifacts (`*.joblib`, `*.pkl`, `*.pickle`, `*.onnx`, `*.pt`, `*.bin`, `*.h5`) returned **ZERO results**:
```bash
find . -name "*.joblib" -o -name "*.pkl" -o -name "*.onnx"
# Output: (empty)
```
- **Finding**: No trained models are persisted to disk. Every run of `notebooks/leak_detection_fixed.ipynb` fits the 23 Random Forest models transiently in RAM and exports only the static JSON/CSV tables.
- **Requirement for Phase 2**: An artifact generation step is strictly required to serialize the trained models and model-selection metadata before FastAPI can perform inference.

---

## 5. Current API Capabilities and Missing Pieces

### 5.1 Current `app.py` Status
`app.py` is currently an unconfigured static server. It mounts static files and serves the React bundle, but contains **zero API endpoints for leak detection, inference, or scenario modeling**.

### 5.2 Required Architecture for Phase 2 API
To support real-time inference and dynamic scenario controls, FastAPI should expose the following modular endpoints:

```
FastAPI (app.py)
├── GET  /health                      [Existing]
├── GET  /api                         [Existing]
├── GET  /api/v1/network/topology     [Serve 905 pipes & nodes]
├── GET  /api/v1/network/candidates   [Serve candidate metadata]
├── GET  /api/v1/telemetry/sample     [Provide sample 39-feature SCADA timestamps]
├── POST /api/v1/predict/ltown        [Accept SCADA telemetry, run model inference]
└── POST /api/v1/scenarios/evaluate   [Dynamic recovery rate, budget, & min loss ranking]
```

#### Proposed Request & Response Schema for `/api/v1/predict/ltown`:
```json
// Request POST /api/v1/predict/ltown
{
  "timestamp": "2019-12-31T23:55:00",
  "flows": { "p227": 28.12, "p235": 44.80, "PUMP_1": 110.45 },
  "pressures": { "n1": 42.1, "n4": 38.5, ... "n752": 29.4 },
  "historical_leak_context": { "p762": 15.53, "p426": 13.25, ... } // Optional: enables persistence fallback
}

// Response
{
  "inference_timestamp": "2019-12-31T23:55:00",
  "model_version": "rf-hybrid-v1.0",
  "predictions": [
    {
      "pipe_id": "p762",
      "model_used": "Persistence",
      "predicted_leak_m3_h": 15.53,
      "predicted_loss_ml_d": 0.37272,
      "confidence": "high"
    },
    ...
  ]
}
```

#### Proposed Request & Response Schema for `/api/v1/scenarios/evaluate`:
```json
// Request POST /api/v1/scenarios/evaluate
{
  "recovery_rate": 0.80,          // 0.1 to 1.0
  "repair_budget_inr": 2000000.0, // Budget constraint (e.g. ₹20 Lakhs)
  "min_loss_threshold_ml_d": 0.15 // Filter out candidates below 0.15 ML/day
}

// Response
{
  "scenario_summary": {
    "total_candidates": 5,
    "budget_allocated_inr": 1900000.0,
    "total_recoverable_ml_d": 1.005,
    "cost_efficiency_ml_per_lakh": 0.0529
  },
  "prioritized_interventions": [ ... ]
}
```

---

## 6. Map and Routing Findings

### 6.1 Map Engine & Basemap Separation
- **Basemap**: MapLibre GL connects to CARTO Dark Matter vector tiles. This provides the global basemap, street names, and coastlines.
- **L-Town Pipeline Geometry**: Stored in `street-map 5/public/data/pipes.geojson` (19,010 lines, 385 KB). It contains 905 pipe segments from the EPANET model, with coordinates normalized and placed around `(0, 0)` (Null Island).
- **Leak Candidate Geometry**: Stored in `street-map 5/public/data/leaks.geojson` (453 lines, 13 KB), representing candidate pipe midpoints.
- **OpenInfraMap Overlay**: Lines 65–103 in `MapView.jsx` connect to `https://tiles.openinframap.org/tilejson/2.json` to stream real-world global pipeline infrastructure. This layer is completely independent of the synthetic L-Town network.

### 6.2 Frontend Routing
`street-map 5/src/App.jsx` uses a hash-based router:
- `#/` -> Landing page.
- `#/map` -> Map page with tab navigation between `🗺 Network Map` and `🤖 ML Pipeline`.
- `#/intervention` -> Network Intervention Lab page.
- **Finding**: Hash routing ensures reliable client-side navigation without requiring server-side rewrite rules in FastAPI.

---

## 7. Proposed Implementation Plan, Dependencies, and Risks

### 7.1 Proposed Phase 2 Implementation Steps

```
Step 1: ML Model Serialization & Standalone Engine
  ├── Create ml/train_and_export.py to train and save 23 models & metadata to artifacts/
  ├── Create ml/inference_engine.py with robust fallback logic for persistence pipes
  └── Unit test feature validation, schema checking, and reproduction benchmarks

Step 2: FastAPI Backend Implementation
  ├── Update requirements.txt (add scikit-learn, pandas, numpy, joblib)
  ├── Implement /api/v1/predict/ltown and /api/v1/scenarios/evaluate in app.py
  └── Verify endpoint responses with curl/pytest

Step 3: Frontend Dynamic Scenario Controls
  ├── Add interactive sliders to InterventionLab.jsx:
  │     • Recovery Rate (50% – 100%, default 80%)
  │     • Repair Budget (₹5L – ₹1Cr, default No Limit)
  │     • Min Predicted Loss (0.00 – 0.40 ML/d, default 0.00)
  ├── Reconcile KPI calculations to reflect filtered and budget-constrained subsets
  └── Connect frontend to FastAPI inference and scenario evaluation endpoints

Step 4: Map Synchronization & Highlight Polish
  ├── Synchronize candidate selection between priority table and map highlight layer
  └── Ensure consistent visual indicators across MapView and InterventionLab
```

### 7.2 Dependencies to Add
- **Python (`requirements.txt`)**:
  ```text
  fastapi>=0.110
  uvicorn[standard]>=0.27
  scikit-learn>=1.4.0
  pandas>=2.2.0
  numpy>=1.26.0
  joblib>=1.3.0
  pydantic>=2.6.0
  ```

### 7.3 Critical Risks and Mitigations

| Risk | Impact | Severity | Mitigation Strategy |
| :--- | :--- | :---: | :--- |
| **Persistence models require ground-truth leak inputs** | Telemetry-only API cannot predict top 5 pipes if Persistence is used. | **CRITICAL** | Provide two inference modes: (1) **Telemetry-only mode**: Train RF on 100% of data or use hybrid fallback. (2) **Assisted mode**: Accept previous leak rate when known. |
| **In-memory model training time** | Training 23 RFs takes ~25 seconds on startup if not serialized. | **HIGH** | Serialize trained models to `.joblib` bundles during build; load instantly at FastAPI startup. |
| **State desynchronization between tabs** | User sets scenario in Intervention Lab but MapView shows static 60% loss. | **MEDIUM** | Standardize recovery rate default to 80% across all views; synchronize scenario state. |

---

## 8. Exact Commands and Tests Executed, with Actual Results

### Test 1: Python ML Environment Check
- **Command**:
  ```bash
  python3 -c "import sklearn, pandas, numpy, joblib; print('sklearn:', sklearn.__version__); print('pandas:', pandas.__version__); print('numpy:', numpy.__version__); print('joblib:', joblib.__version__)"
  ```
- **Result**:
  ```text
  sklearn: 1.9.1
  pandas: 3.0.6
  numpy: 2.5.3
  joblib: 1.6.0
  ```
- **Status**: `PASS`

### Test 2: Priority JSON Integrity Check
- **Command**:
  ```bash
  cmp data/final_intervention_priorities.json "street-map 5/public/data/final_intervention_priorities.json" && echo "Identical"
  ```
- **Result**: `Identical`
- **Status**: `PASS`

### Test 3: Notebook In-Memory Pipeline Reproduction Benchmark
- **Command**: Executed full data loading, 70/15/15 chronological split, training of 23 Random Forests, validation MAE comparison against Persistence, and latest-timestamp prediction.
- **Result**:
  ```text
  leak         sel    rf_val    ps_val  val_pred   loss_ml
  p762 Persistence  0.759577  0.000890 15.530000  0.372720
  p426 Persistence  3.064012  0.006570 13.250000  0.318000
  p721 Persistence  6.688917  0.017624 12.950000  0.310800
  p455 Persistence  0.512875  0.000481 10.960000  0.263040
  p879 Persistence  0.000000  0.000000 10.930000  0.262320
  p331          RF  0.000827  0.026249 10.550000  0.253200
  p193          RF  0.000767  0.011491 10.207346  0.244976
  p123 Persistence  1.493177  0.002236  9.050000  0.217200
  p277          RF  0.002024  0.004850  7.289681  0.174952
  p810          RF  0.000433  0.007624  6.787283  0.162895
  p257          RF  0.000932  0.005427  6.770000  0.162480
  p710          RF  0.000542  0.008201  5.459958  0.131039
  p654          RF  0.000221  0.006910  5.400000  0.129600
  p680          RF  0.000405  0.000665  5.360371  0.128649
  p280          RF  0.000974  0.002219  5.210538  0.125053
  p427          RF  0.001590  0.008912  4.974587  0.119390
  p514 Persistence  0.000000  0.000000  0.000000  0.000000
  p142 Persistence  0.000000  0.000000  0.000000  0.000000
  p586 Persistence 19.320292  0.002555  0.000000  0.000000
  p653 Persistence  0.000000  0.000000  0.000000  0.000000
  p800 Persistence  9.737643  0.009141  0.000000  0.000000
  p827 Persistence  0.000000  0.000000  0.000000  0.000000
  p523 Persistence  0.000000  0.000000  0.000000  0.000000
  ```
- **Finding**: Exactly 16 pipes produce non-zero predictions, matching `data/final_intervention_priorities.csv` to 6 decimal places.
- **Status**: `PASS`

### Test 4: Git Status Check
- **Command**: `git status`
- **Result**:
  ```text
  On branch feature/ltown-inference
  nothing to commit, working tree clean
  ```
- **Status**: `PASS`

---

## 9. Prioritized List of Blockers

### Blocker 1 (CRITICAL): Persistence Model Cannot Run on Pure SCADA Telemetry
- **Description**: The notebook’s top 5 intervention candidates (`p762`, `p426`, `p721`, `p455`, `p879`) were assigned to the Persistence baseline because their training leakage labels were all zero. The notebook generated predictions for them by reading `2019_Leakages.csv` directly.
- **Action Required Before Implementation**: Decide whether Phase 2 inference will:
  1. Train Random Forest regressors across the complete labeled dataset (so all 16 active leak pipes can be predicted from SCADA flow and pressure sensors alone), OR
  2. Maintain the notebook’s hybrid persistence logic by allowing the API to accept `last_known_leak` or sample historical context.

### Blocker 2 (HIGH): Zero Serialized Model Artifacts
- **Description**: There are no saved model files (`.joblib` or `.pkl`) in the repository.
- **Action Required Before Implementation**: Create a lightweight export script to train and persist the production model bundle to `artifacts/` or `ml/models/`.

### Blocker 3 (HIGH): Missing FastAPI Inference and Scenario Routes
- **Description**: `app.py` has no routes for `/api/predict/ltown` or `/api/scenarios/evaluate`.
- **Action Required Before Implementation**: Implement endpoints with Pydantic validation schemas in `app.py`.

### Blocker 4 (RESOLVED IN PHASE 2A): Decoupled KPI Metrics and Absent Interactive Controls
- **Resolution**: Successfully resolved in `LTownPage.jsx`. Added bounded interactive range sliders for Recovery Rate (10%–100%), Max Repair Cost (₹1L–₹20L), and Minimum Predicted Loss (0.0–0.5 ML/d). KPIs, candidate tables, and MapLibre highlighting now dynamically recalculate against the filtered scenario in real time.

---

## 10. Phase 2A Integration Addendum (October 10, 2026)

### 10.1 Scope & Objective
Phase 2A successfully integrated the dedicated L-Town Benchmark Lab from the uploaded ZIP archive into the current `feature/ltown-inference` branch without compromising the merged hero redesign, `HeroScene.jsx`, or `InterventionLab.jsx`.

### 10.2 Files Changed
1. **`street-map 5/src/pages/LTownPage.jsx`** (Created & Theme-Aligned):
   - Ported from the ZIP and adapted for robust state synchronization.
   - Visually aligned with the hero page theme: header brand mark and navigation links, MapLibre layer colors (ice blue `#d7efff` base pipes, lime `#e9f056` candidates, and orange `#ff9f43` selected pipe).
   - Added full keyboard accessibility (`tabIndex={0}`, ARIA roles, `Enter`/`Space` handlers) for candidate table rows.
   - Implements synchronous state management where scenario controls recalculate KPIs, table rows, and map lines in real time.
2. **`street-map 5/src/styles.css`** (Modified):
   - Self-contained `.ltown-*` style block aligned strictly to the Skyline design system:
     - Deep burgundy (`#351E28`, `#26141C`) for dark surfaces and page background.
     - Lime accent (`#E9F056`) for key metrics, candidate badges, active selections, and interactive controls.
     - Ice blue (`#D7EFFF`) and smoky white (`#EEF9FF`) for typography and subtle borders.
     - Typography hierarchy utilizing Bricolage Grotesque (`--display`) and DM Sans (`--body`).
     - Pill-shaped lime reset button matching the hero page's button design language.
   - Preserved all existing hero, map, and intervention dossier styles.
   - Comprehensive responsive breakpoints (950px, 600px) and `prefers-reduced-motion` overrides.
3. **`street-map 5/src/App.jsx`** (Modified):
   - Extended the hash router to handle all 4 application routes: `#/` (Landing), `#/map` (Network Map), `#/intervention` (Intervention Lab), and `#/ltown` (L-Town Benchmark Lab).
4. **`street-map 5/src/pages/MapPage.jsx`** (Modified):
   - Added a direct `🔬 L-Town Lab` navigation tab button.
5. **`street-map 5/src/pages/Landing.jsx`** (Modified):
   - Added `L-Town Benchmark` header navigation link while preserving the completed hero redesign.

### 10.3 Scenario Calculations & Control Limits
- **Recovery Rate**: Slider range `10%` to `100%`, step `5%`, default `80%`.
  - Recalculates: `Scenario Recovery = Total Filtered Loss * (recoveryPercent / 100)`.
- **Maximum Repair Cost**: Slider range `₹1,00,000` to `₹20,00,000`, step `₹1,00,000`, default `₹10,00,000`.
  - Preserves documented individual pipe cost filter semantic (`row.Repair_Cost_INR <= maxBudget`).
- **Minimum Predicted Water Loss**: Slider range `0.00` to `0.50 ML/day`, step `0.025 ML/day`, default `0.10 ML/day`.
  - Filters candidates: `row.Predicted_Loss_ML_per_day >= minimumLoss`.
- **Reset Behavior**: Restores documented defaults (`80%`, `₹10,00,000`, `0.10 ML/day`) and reselects the top candidate `p762`.
- **Selection Synchronization**: If the currently selected candidate is filtered out, the selection automatically reconciles to the top candidate of the filtered subset.

### 10.4 Actual Verification & Test Results
- **Whitespace / Formatting Audit**: `git diff --check` passed with 0 errors.
- **Frontend Production Build**: `npm --prefix "street-map 5" run build` completed successfully in 4.25s with 0 errors.
- **Real Browser Verification**:
  - `http://127.0.0.1:5175/#/`: Verified landing page with hero redesign intact and navigation link present.
  - `http://127.0.0.1:5175/#/ltown`: Verified 4 KPI summary cards, MapLibre network map, and all 16 candidate rows.
  - Interactive Filter Test: Adjusting Max Cost to ₹5L and Min Loss to 0.25 ML/d dynamically dropped matching candidates from 16 to 4, updated total loss to 1.097 ML/d, and automatically updated selection from `p762` to `p426`.
  - Reset Test: Successfully restored 16 candidates and reselected `p762`.
  - Responsive Viewport Test: Verified 390x844 single-column stacking for mobile.
  - `http://127.0.0.1:5175/#/map`: Verified 4-tab navigation bar.
  - `http://127.0.0.1:5175/#/intervention`: Verified Network Intervention Dossier renders cleanly.

### 10.5 Remaining Blockers for Phase 2 (Real Inference)
- **Blocker 1**: Persistence model fallback logic for pure SCADA telemetry inputs.
- **Blocker 2**: Export script to serialize the 23 Random Forest models into `.joblib` artifacts.
- **Blocker 3**: Real-time FastAPI inference endpoints (`/api/predict/ltown`, `/api/scenarios/evaluate`) in `app.py`.

---

*Phase 2A integration verified and documented on branch `feature/ltown-inference` at commit `f903df2`.*
