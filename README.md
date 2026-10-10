# Leak Detection & Intervention Prioritization

## Overview

This project uses SCADA flow and pressure data from the L-TOWN water network to identify **candidate locations with high estimated water loss** and prioritize where a water utility should investigate first.

The pipeline combines:

- SCADA flow data
- SCADA pressure data
- Historical leakage data
- Machine learning
- Network topology
- Water-loss calculations
- Intervention/recovery scenarios

The final output is a ranked list of candidate pipes that can be used by the frontend to visualize and prioritize field investigation.

---

## Project Structure

```text
Leak_Detection_Model/
│
├── data/
│   ├── 2019_SCADA_Flows.csv
│   ├── 2019_SCADA_Pressures.csv
│   ├── 2019_Leakages.csv
│   ├── L-TOWN_Real.inp
│   │
│   ├── final_intervention_priorities.csv
│   ├── final_intervention_priorities.json
│   ├── network_topology.csv
│   ├── network_topology.json
│   ├── candidate_pipe_locations.csv
│   └── candidate_pipe_locations.json
│
├── notebooks/
│   └── leak_detection.ipynb
│
└── README.md
```

---

## Data

The model uses three main SCADA datasets:

### Flow Data

`2019_SCADA_Flows.csv`

Contains timestamped flow measurements from the network.

### Pressure Data

`2019_SCADA_Pressures.csv`

Contains timestamped pressure measurements from network sensors/nodes.

### Leakage Data

`2019_Leakages.csv`

Contains historical leakage values for 23 candidate leakage pipe locations.

Leakage values are represented in **L/s**.

---

# Model Pipeline

The overall pipeline is:

```text
SCADA Data
     ↓
Data Cleaning & Merging
     ↓
Feature Engineering
     ↓
Model Experiments
     ↓
Random Forest + Persistence
     ↓
Validation-Based Model Selection
     ↓
Future Test Evaluation
     ↓
Current Leakage Prediction
     ↓
Network Topology Mapping
     ↓
Candidate Region Formation
     ↓
Water Loss & Recovery Calculation
     ↓
Intervention Prioritization
     ↓
JSON / CSV Outputs
```

---

## Why Multiple Models Were Tested

Several approaches were initially tested.

### 1. Leak / No-Leak Classification

This was not useful because leakage was present at every timestamp in the dataset.

### 2. Dominant Leak Location Classification

The pipe with the highest leakage at each timestamp was used as the target.

This produced high performance on randomly shuffled data but performed poorly when tested chronologically on future data.

Therefore, this approach was rejected.

### 3. Multi-Label Leak Prediction

Multiple leaking pipes were predicted simultaneously.

This also performed poorly at identifying changing future leakage locations.

Therefore, this approach was rejected.

### 4. Leakage Amount Regression

The final approach predicts the **amount of leakage at each candidate pipe**.

Two approaches were compared:

- Random Forest Regression
- Persistence baseline (using the previous leakage value)

For each pipe, the better-performing approach was selected using the validation dataset.

---

# Final Model

The final system uses a hybrid strategy:

```text
                ┌── Random Forest ──┐
SCADA Data ────┤                   ├──→ Best model per pipe
                └── Persistence ────┘
```

Some pipes are predicted better by Random Forest, while others are better represented by the persistence baseline.

The model therefore does **not** force one method onto every pipe.

---

# Model Evaluation

The data was divided chronologically:

- **70%** training
- **15%** validation
- **15%** final test

The final test set represents future unseen observations.

### Final Test Performance

**MAE: approximately 0.0051 L/s**

MAE = Mean Absolute Error.

This means the selected approach had an average absolute prediction error of approximately **0.0051 L/s** across the evaluated candidate locations in the final test period.

> This is a regression model, so performance should be reported using regression metrics such as MAE rather than a percentage "accuracy."

---

# Network Topology

The L-TOWN network contains:

- **785 nodes**
- **905 pipes**

The network topology was extracted from:

`L-TOWN_Real.inp`

Each pipe is represented using its start and end nodes and coordinates.

The topology is used to determine where the predicted candidate pipes are located within the network.

---

# Candidate Regions

Candidate pipes were grouped using their network connectivity/distance.

This produced **4 topology-derived analytical regions** containing the active candidate pipes.

These are **not official utility DMAs**.

They are analytical groupings created for prioritization and visualization.

---

# Water Loss Calculation

Model predictions are originally in L/s.

They are converted to daily water loss using:

```text
Litres/day = L/s × 86,400
```

and:

```text
ML/day = Litres/day ÷ 1,000,000
```

This allows the output to be expressed in a form that is easier for utility decision-making.

---

# Recovery Scenario

A scenario recovery factor of **80%** is used.

```text
Potential Recovery =
Predicted Loss × 0.80
```

This means the recovery figures represent a **scenario**, not a guaranteed result.

Actual recovery would depend on field investigation and successful repair.

---

# Intervention Cost

Illustrative repair costs are assigned to candidate pipes.

These costs are **scenario inputs**, not actual utility quotations.

They are used to demonstrate how estimated water recovery can be compared with intervention cost.

---

# Final Output

The main output is:

### `final_intervention_priorities.json`

This contains the prioritized candidate pipes and includes:

- Region priority
- Network region
- Pipe priority within region
- Candidate pipe ID
- Start node
- End node
- Predicted loss (ML/day)
- Potential recovery (ML/day)
- Illustrative repair cost
- Recovery per ₹1 lakh
- Recommendation

Example:

```text
p762
Predicted loss: 1.342 ML/day
Potential recovery: 1.073 ML/day
Recommendation: Critical Water Loss
```

---

# Frontend Files

The frontend can directly use the following JSON files:

### `final_intervention_priorities.json`

Main intervention ranking and decision data.

### `network_topology.json`

Contains the complete 905-pipe network for visualization.

### `candidate_pipe_locations.json`

Contains the candidate pipes along with their coordinates for highlighting them on the map.

---

# Important Interpretation

The model identifies **candidate locations for investigation**.

It does **not** prove that a specific pipe is physically broken or leaking.

Therefore, frontend wording should use:

> Candidate pipe

> Estimated loss

> Investigate

rather than:

> Confirmed leak

> Broken pipe

The model is intended to help utilities **prioritize where to investigate first**.

---

# Final Decision Flow

The intended decision process is:

```text
Where is water loss concentrated?
            ↓
Which candidate pipes are highest priority?
            ↓
How much water is potentially recoverable?
            ↓
What intervention gives the highest impact?
            ↓
Where should field teams investigate first?
```

---

# Frontend Goal

The frontend should transform the model output into an intuitive utility decision-support interface.

The main story should be:

> **Detect → Locate → Prioritize → Investigate → Estimate Impact**

The network map and intervention priority list should be the primary visual elements.

---

## Key Assumptions

- Leakage values are measured in L/s.
- Recovery uses an 80% scenario assumption.
- Repair costs are illustrative.
- Candidate pipes are not confirmed leaks.
- Network regions are analytical groupings, not official DMAs.
- Predictions are based on available SCADA and historical leakage data.
- Final field decisions require real-world investigation.

---

## Main Deliverables

For the frontend:

```text
final_intervention_priorities.json
network_topology.json
candidate_pipe_locations.json
```

For reproducibility/documentation:

```text
leak_detection.ipynb
model performance.csv
README.md
```

