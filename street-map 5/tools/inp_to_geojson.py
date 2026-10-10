#!/usr/bin/env python3
"""
Convert an EPANET .inp network + the ML leak table (CSV) into two GeoJSON files
for the map:

  pipes.geojson  - every pipe as a line
  leaks.geojson  - one point per leak (placed at the middle of its pipe),
                   carrying all the columns from the CSV

Usage:
  python inp_to_geojson.py network.inp leaks.csv --out ../public/data
  python inp_to_geojson.py network.inp leaks.csv --out ../public/data --crs EPSG:32643

--crs is the coordinate system the .inp coordinates are in. Leave it off if they
are already longitude/latitude. Needs `pip install pyproj` only when --crs is used.

No other dependencies (standard library only).
"""
import argparse
import csv
import json
import math
import os
import sys


def parse_inp(path):
    """Return (nodes, pipes, vertices) from an EPANET .inp file."""
    nodes, pipes, vertices = {}, {}, {}
    section = None
    with open(path, "r", errors="replace") as f:
        for raw in f:
            line = raw.split(";", 1)[0].strip()
            if not line:
                continue
            if line.startswith("["):
                section = line.strip("[]").upper()
                continue
            parts = line.split()
            try:
                if section == "COORDINATES" and len(parts) >= 3:
                    nodes[parts[0]] = (float(parts[1]), float(parts[2]))
                elif section == "PIPES" and len(parts) >= 3:
                    pipes[parts[0]] = (parts[1], parts[2])
                elif section == "VERTICES" and len(parts) >= 3:
                    vertices.setdefault(parts[0], []).append(
                        (float(parts[1]), float(parts[2]))
                    )
            except ValueError:
                continue
    return nodes, pipes, vertices


def line_midpoint(coords):
    """Point halfway along a polyline (by length)."""
    seg = [math.dist(a, b) for a, b in zip(coords, coords[1:])]
    total = sum(seg)
    if total == 0:
        return coords[0]
    half, run = total / 2, 0.0
    for (a, b), d in zip(zip(coords, coords[1:]), seg):
        if run + d >= half:
            t = (half - run) / d if d else 0
            return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
        run += d
    return coords[-1]


def coerce(v):
    """CSV strings -> numbers where possible."""
    try:
        f = float(v)
        return int(f) if f.is_integer() and "." not in v else f
    except (ValueError, TypeError):
        return v


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inp")
    ap.add_argument("csv")
    ap.add_argument("--out", default=".")
    ap.add_argument("--crs", help="source CRS of the .inp coordinates, e.g. EPSG:32643")
    ap.add_argument("--pipe-col", default="Leak_Location", help="CSV column holding the pipe ID")
    args = ap.parse_args()

    nodes, pipes, vertices = parse_inp(args.inp)
    if not nodes or not pipes:
        sys.exit("Couldn't find [COORDINATES] / [PIPES] sections in the .inp file.")

    project = None
    if args.crs:
        try:
            from pyproj import Transformer
        except ImportError:
            sys.exit("--crs needs pyproj:  pip install pyproj")
        t = Transformer.from_crs(args.crs, "EPSG:4326", always_xy=True)
        project = lambda xy: t.transform(*xy)

    def tx(xy):
        return project(xy) if project else xy

    def pipe_coords(pid):
        a, b = pipes[pid]
        if a not in nodes or b not in nodes:
            return None
        pts = [nodes[a]] + vertices.get(pid, []) + [nodes[b]]
        return [tx(p) for p in pts]

    # ---- pipes ----
    pipe_features, xs, ys = [], [], []
    for pid in pipes:
        c = pipe_coords(pid)
        if not c:
            continue
        for x, y in c:
            xs.append(x)
            ys.append(y)
        pipe_features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": [list(p) for p in c]},
            "properties": {"id": pid, "start": pipes[pid][0], "end": pipes[pid][1]},
        })

    # ---- leaks ----
    leak_features, missing = [], []
    with open(args.csv, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            pid = (row.get(args.pipe_col) or "").strip()
            c = pipe_coords(pid) if pid in pipes else None
            if not c:
                missing.append(pid)
                continue
            props = {k: coerce(v) for k, v in row.items() if k and k.strip() and k != ""}
            leak_features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": list(line_midpoint(c))},
                "properties": props,
            })

    os.makedirs(args.out, exist_ok=True)
    for name, feats in (("pipes", pipe_features), ("leaks", leak_features)):
        with open(os.path.join(args.out, f"{name}.geojson"), "w") as f:
            json.dump({"type": "FeatureCollection", "features": feats}, f)

    # ---- summary: paste this back so we can check the coordinates ----
    print("\n=== Summary ===")
    print(f"Nodes: {len(nodes)}  Pipes: {len(pipes)}  Pipes drawn: {len(pipe_features)}")
    print(f"Leaks placed: {len(leak_features)}  Not found in network: {len(missing)} {missing[:10]}")
    if xs:
        print(f"X range: {min(xs):.5f} .. {max(xs):.5f}")
        print(f"Y range: {min(ys):.5f} .. {max(ys):.5f}")
        looks_geo = -180 <= min(xs) and max(xs) <= 180 and -90 <= min(ys) and max(ys) <= 90
        print("Looks like longitude/latitude." if looks_geo else
              "NOT lon/lat - these are local or projected coordinates (see --crs).")
    print(f"Wrote pipes.geojson and leaks.geojson to {os.path.abspath(args.out)}")


if __name__ == "__main__":
    main()
