# Showing ML-detected pipeline leaks on the map

Notes from the planning discussion, plus the converter script that goes with them.

## Goal

Visualise the output of a colleague's ML leak-detection model on the 3D street map:
the pipe network as lines, and each detected leak as a marker on its pipe.

## What the model output looks like

A table with one row per leak. Columns seen so far:

| Column | Meaning |
| --- | --- |
| `Region_Priority`, `Network_Region`, `Pipe_Priority_Within_Region` | Ranking and grouping of the leaks |
| `Leak_Location` | Pipe ID, e.g. `p762` |
| `Start_Node`, `End_Node` | Node IDs at the ends of that pipe, e.g. `n683`, `n264` |
| `Predicted_Loss_ML_per_day` | Estimated water loss (megalitres/day) |
| `Recoverable_ML_per_day` | Water that could be recovered by fixing the leak |
| `Repair_Cost_INR` | Estimated repair cost |
| `Recoverable_ML_per_1Lakh` | Recoverable ML per 1 lakh INR spent |
| `Recommendation` | `Critical Water Loss`, `High Water Loss`, `Cost Efficient`, `Investigate` |

## The key finding: there are no coordinates in the table

Leaks are identified by pipe and node IDs only. The p### / n### naming looks like an
EPANET-style water network model, so the locations live in the network's `.inp` file:

- `[COORDINATES]` gives an x, y for every node
- `[PIPES]` says which two nodes each pipe connects
- `[VERTICES]` (optional) gives bend points along a pipe

Joining the leak table to these gives a position for every leak.

## The open question: are the coordinates real-world?

This decides whether the network can sit on the street map.

- **Longitude/latitude:** works directly.
- **Projected (e.g. UTM):** works if the coordinate system is known (e.g. `EPSG:32643`).
- **Local/arbitrary:** cannot be placed on real streets without reference points. It could still
  be drawn as a flat diagram.

## Workflow

1. Get the `.inp` file and export the leak table as CSV (keep the `Leak_Location` column).
2. Run the converter (below) on your own machine, since the `.inp` is too large to share.
3. Check the summary it prints: leaks placed, pipe IDs not found, coordinate ranges, and whether
   the coordinates look like lon/lat. If not, re-run with `--crs`.
4. Put `pipes.geojson` and `leaks.geojson` in the project's `public/data/` folder.
5. Add the layers to the map (not built yet, see "Still to do").

## The converter script

`tools/inp_to_geojson.py` uses only the Python standard library (plus `pyproj` if `--crs` is used).

```bash
python inp_to_geojson.py network.inp leaks.csv --out ../public/data
python inp_to_geojson.py network.inp leaks.csv --out ../public/data --crs EPSG:32643
```

- `pipes.geojson`: every pipe as a line
- `leaks.geojson`: one point per leak, placed at the middle of its pipe, carrying all CSV columns
- Prints a summary; if it reports "NOT lon/lat", the coordinates need `--crs`

It was tested on a small made-up network only, not on the real data.

## Planned map layers (not built yet)

Loading the GeoJSON in `src/components/MapView.jsx` once the map has loaded:

```js
map.addSource('pipes', { type: 'geojson', data: '/data/pipes.geojson' })
map.addLayer({ id: 'pipes', type: 'line', source: 'pipes',
  paint: { 'line-color': '#5b6b9a', 'line-width': 1.5 } })

map.addSource('leaks', { type: 'geojson', data: '/data/leaks.geojson' })
map.addLayer({ id: 'leaks', type: 'circle', source: 'leaks',
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['get', 'Predicted_Loss_ML_per_day'], 0.4, 6, 1.4, 16],
    'circle-color': ['match', ['get', 'Recommendation'],
      'Critical Water Loss', '#ff3b3b',
      'High Water Loss', '#ff8c42',
      'Investigate', '#ffd166',
      'Cost Efficient', '#4cc38a',
      '#999999'],
    'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5,
  } })
```

Plus click popups showing the full row, a legend, and filters.

## Still to do

- Confirm the coordinate system of the `.inp` (run the script and check the summary)
- Add pipe and leak layers to the map
- Popups with all the leak numbers
- Legend and filters by Recommendation and region
- Optional total of recoverable ML per day

## Notes

- Pipeline and leak locations are often confidential infrastructure data. Check who may see them
  before publishing, and consider requiring a login.
- If the data is later served live, it needs a small backend endpoint with CORS configured.
