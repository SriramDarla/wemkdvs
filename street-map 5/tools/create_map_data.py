import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
OUT = ROOT / "street-map 5" / "public" / "data"

# Read the local X/Y coordinates from both CSVs.
with (DATA / "network_topology.csv").open(newline="") as f:
    pipes = list(csv.DictReader(f))

with (DATA / "candidate_pipe_locations.csv").open(newline="") as f:
    leaks = list(csv.DictReader(f))

# Convert local coordinates into a small, normalized schematic space.
# These are NOT real-world longitude/latitude coordinates.
all_x, all_y = [], []

for p in pipes:
    all_x.extend([float(p["Start_X"]), float(p["End_X"])])
    all_y.extend([float(p["Start_Y"]), float(p["End_Y"])])

for leak in leaks:
    all_x.extend([float(leak["Start_X"]), float(leak["End_X"])])
    all_y.extend([float(leak["Start_Y"]), float(leak["End_Y"])])

min_x, max_x = min(all_x), max(all_x)
min_y, max_y = min(all_y), max(all_y)

def point(x, y):
    x, y = float(x), float(y)
    # Map the entire network into a compact schematic extent.
    lng = -0.1 + 0.2 * (x - min_x) / max(max_x - min_x, 1)
    lat = -0.1 + 0.2 * (y - min_y) / max(max_y - min_y, 1)
    return [lng, lat]

pipe_features = []
for p in pipes:
    pipe_features.append({
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": [
                point(p["Start_X"], p["Start_Y"]),
                point(p["End_X"], p["End_Y"]),
            ],
        },
        "properties": {
            "Pipe": p["Pipe"],
            "Start_Node": p["Start_Node"],
            "End_Node": p["End_Node"],
        },
    })

leak_features = []
for leak in leaks:
    start = point(leak["Start_X"], leak["Start_Y"])
    end = point(leak["End_X"], leak["End_Y"])
    midpoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]

    leak_features.append({
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": midpoint},
        "properties": {
            key: value for key, value in leak.items()
        },
    })

OUT.mkdir(parents=True, exist_ok=True)

for filename, features in [
    ("pipes.geojson", pipe_features),
    ("leaks.geojson", leak_features),
]:
    path = OUT / filename
    path.write_text(json.dumps({
        "type": "FeatureCollection",
        "features": features,
    }, indent=2))
    print(f"Created {path} — {len(features)} features")

print("Schematic coordinate conversion complete.")
