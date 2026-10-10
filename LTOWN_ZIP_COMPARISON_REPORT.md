# L-Town Version Comparison & Integration Report

**Date**: October 10, 2026
**Active Working Branch**: `feature/ltown-inference`
**Base Commit**: `f903df211a36e6866b369e74cd9e3e8dda2e83ba` (`Merge pull request #1 from SriramDarla/feature/hero-redesign`)
**Source ZIP Location**: `/Users/tejaskumar/Downloads/wemkdvs-main (1).zip` (33.15 MB, extracted to `/tmp/wemkdvs_zip_extracted/`)
**Target Repository**: `SriramDarla/wemkdvs` (`/Users/tejaskumar/SriramsWemakeDev/wemkdvs`)

---

## 1. Verification of Current Repository State

- **Repository Path**: `/Users/tejaskumar/SriramsWemakeDev/wemkdvs`
- **Current Git Branch**: `feature/ltown-inference`
- **Head Commit**: `f903df2` (includes merged hero redesign PR #1 and Network Intervention Lab)
- **Remotes**: `origin` -> `https://github.com/SriramDarla/wemkdvs.git`
- **Working Tree Status**: Clean (only the pre-audit report `LTOWN_PHASE2_AUDIT.md` is untracked)

---

## 2. Directory Structure & File-by-File Comparison

| Path / Component | Current GitHub Version (`f903df2`) | Uploaded ZIP Version (`wemkdvs-main (1).zip`) | Comparison Finding |
| :--- | :--- | :--- | :--- |
| `street-map 5/src/pages/LTownPage.jsx` | **ABSENT** | **PRESENT** (18.3 KB, 532 lines) | **CRITICAL DIFFERENCE**: The ZIP contains the dedicated L-Town benchmark dashboard with interactive sliders. |
| `street-map 5/src/LTownPage.jsx` | **ABSENT** | **PRESENT** (18.3 KB, duplicate) | Redundant copy in `src/` (differs only by 20px vs 40px map padding from `pages/LTownPage.jsx`). |
| `street-map 5/src/pages/InterventionLab.jsx` | **PRESENT** (29.9 KB, 653 lines) | **ABSENT** | Current GitHub version contains the complete multi-attribute utility intervention dossier. |
| `street-map 5/src/pages/Landing.jsx` | **MERGED HERO REDESIGN** (3.8 KB) | **OLD LANDING PAGE** (3.1 KB) | The ZIP contains the outdated generic 3D city landing page without leak detection messaging. |
| `street-map 5/src/components/HeroScene.jsx` | **SCIENTIFIC SCHEMATIC** (10.3 KB) | **OLD CITY 3D ISOMETRIC** (7.1 KB) | Current GitHub version has the refined hydraulic schematic (nodes, flow meters, sensors, p762 callout). |
| `street-map 5/src/App.jsx` | Routes: `#/`, `#/map`, `#/intervention` | Routes: `#/`, `#/map`, `#/ltown` | The ZIP routes to `LTownPage`, while GitHub routes to `InterventionLab`. |
| `street-map 5/src/pages/MapPage.jsx` | Nav tabs include `🧪 Intervention Lab` | Nav tabs include only `map` and `pipeline` | Current GitHub version connects to the intervention lab. |
| `street-map 5/src/components/MapView.jsx` | Present (55.3 KB, 1,228 lines) | Present (55.3 KB, 1,228 lines) | **100% IDENTICAL** (byte-for-byte exact match). |
| `street-map 5/src/styles.css` | 46.3 KB (contains hero & `.lab-` styles) | 35.1 KB (contains `.ltown-` styles) | The ZIP has 330 lines of `.ltown-*` styles; GitHub has the hero redesign & `.lab-*` styles. |
| `data/` (All 12 CSVs / JSONs) | Present | Present | **100% IDENTICAL** (byte-for-byte exact match). |
| `street-map 5/public/data/` | Present | Present | **100% IDENTICAL** (byte-for-byte exact match). |
| `notebooks/leak_detection_fixed.ipynb`| Present (26 cells) | Present (26 cells) | **100% IDENTICAL** (byte-for-byte exact match). |
| `app.py` & `requirements.txt` | Present (FastAPI static server) | Present (FastAPI static server) | **100% IDENTICAL** (byte-for-byte exact match). |
| `street-map 5/package.json` | Present | Present | **100% IDENTICAL** (byte-for-byte exact match). |
| `inspection.txt` | **ABSENT** | **PRESENT** (25.3 KB) | Code reference dump in the ZIP. |

---

## 3. Detailed Audit of the ZIP's `LTownPage.jsx`

The uploaded ZIP's `LTownPage.jsx` directly answers the Phase 2 audit questions regarding scenario controls:

### 3.1 Interactive Scenario Controls Implemented in the ZIP
1. **Assumed Recovery Rate Slider (`recoveryPercent`)**:
   - Range: `10%` to `100%` (step: `5%`, default: `80%`)
   - Recalculates: `totalPotentialRecovery = totalPredictedLoss * (recoveryPercent / 100)`
   - Dynamically updates candidate recovery in both the table and selected candidate card.
2. **Maximum Repair Cost Slider (`maxBudget`)**:
   - Range: `₹1,00,000` to `₹20,00,000` (step: `₹1,00,000`, default: `₹10,00,000`)
   - Filters candidate pipes: `cost <= maxBudget`
3. **Minimum Predicted Loss Slider (`minimumLoss`)**:
   - Range: `0.0` to `0.5 ML/day` (step: `0.025 ML/day`, default: `0.10 ML/day`)
   - Filters candidate pipes: `loss >= minimumLoss`
4. **Scenario Reset Button**:
   - Resets state to defaults (`80%`, `₹10,00,000`, `0.10 ML/day`).

### 3.2 State Consistency in the ZIP
- **KPI Metrics Consistency**: Unlike `InterventionLab.jsx`, `LTownPage.jsx` computes metrics directly against `filteredPriorities`. When sliders move, **KPI cards, candidate count, and table rows update synchronously**.
- **Map Synchronization**:
  - The embedded MapLibre component (`NetworkMap`) draws `ltown-pipes` (`#28c7d9`), `ltown-candidates` (`#d6f36a`), and `ltown-selected` (`#ff9f43`).
  - As scenario filters change, `updateMapSources` dynamically updates the GeoJSON features on the map so that only matching candidate lines remain highlighted.
  - Clicking a candidate row or map line highlights that specific pipe segment in bright orange (`#ff9f43`).

---

## 4. Reusability & Classification Matrix

### A. Reuse As-Is / Port In
- **`street-map 5/src/pages/LTownPage.jsx`**: Port as the dedicated visual benchmark lab.
- **`.ltown-*` CSS Rules from ZIP's `styles.css`**: Append lines 909–1238 of the ZIP's stylesheet into `street-map 5/src/styles.css`. This styles the dashboard cards, sliders, map container, and table.

### B. Adapt & Integrate
- **`street-map 5/src/App.jsx`**:
  - Keep the hash router.
  - Retain `#/` (Landing), `#/map` (MapPage), and `#/intervention` (InterventionLab).
  - Add route `#/ltown` -> `<LTownPage />`.
- **Top Navigation Links**:
  - In `Landing.jsx` and `MapPage.jsx`: Add access to the L-Town benchmark view (`#/ltown`).
  - In `LTownPage.jsx`: Update header navigation so users can navigate back to `#/` (Home), `#/map` (Network Map), and `#/intervention` (Intervention Lab).

### C. Exclude / Do Not Overwrite
- **DO NOT overwrite `Landing.jsx`**: The ZIP's landing page is outdated and would erase the merged hero redesign.
- **DO NOT overwrite `HeroScene.jsx`**: The ZIP contains the old generic city buildings.
- **DO NOT delete `InterventionLab.jsx`**: It contains the comprehensive multi-attribute utility prioritization dossier.
- **DO NOT copy duplicate `street-map 5/src/LTownPage.jsx`**: Only place in `src/pages/LTownPage.jsx`.
- **DO NOT replace `inspection.txt`**: Not needed in production codebase.

---

## 5. Recommended Minimal Integration Plan

```
Integration Step 1: Add LTownPage Component
  └── Copy /tmp/wemkdvs_zip_extracted/.../src/pages/LTownPage.jsx
      into street-map 5/src/pages/LTownPage.jsx

Integration Step 2: Append .ltown-* Styles
  └── Extract lines 909–1238 (.ltown-page, .ltown-controls, .ltown-map-canvas, etc.)
      from ZIP styles.css and append to street-map 5/src/styles.css
      (Preserves all existing hero, MapView, and InterventionLab styles)

Integration Step 3: Update Hash Routing in App.jsx
  └── Add route: if (hash.startsWith('#/ltown')) return 'ltown'
      Render <LTownPage /> when route === 'ltown'

Integration Step 4: Add Navigation Entry Points
  ├── In street-map 5/src/pages/MapPage.jsx:
  │   Add nav tab button: <a href="#/ltown" className="nav-tab nav-tab-link">🔬 L-Town Lab</a>
  └── In street-map 5/src/pages/LTownPage.jsx:
      Ensure back links point to "#/" (Home), "#/map" (Map), and "#/intervention" (Dossier)

Integration Step 5: Validation & Verification
  ├── Run Vite production build (npm run build)
  ├── Verify clean rendering of #/, #/map, #/intervention, and #/ltown
  └── Verify that recovery, budget, and min-loss sliders dynamically update KPIs, table, and map
```

---

## 6. Strict Boundary Confirmation

- Current working repository was **not** overwritten, reset, or replaced.
- Extraction was performed entirely inside `/tmp/wemkdvs_zip_extracted/`.
- No application code, dependencies, datasets, models, or Git branches have been modified.
