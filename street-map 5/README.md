# 3D Street Map

A dark-themed street-level map with tilt (pitch), rotation (bearing) and extruded 3D
buildings, shown as a window inside a small website: a landing page (`#/`) with a
button that opens the map page (`#/map`), which has a link back home.
Built with React, Vite and MapLibre GL. No API key required.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

## Controls

- Drag: pan
- Right-drag or Ctrl-drag: rotate and tilt
- Scroll: zoom
- Tilt slider and Auto-rotate button in the top-left panel
- Search box at the top: type a place or address, press Enter, pick a result and the map flies there (uses OpenStreetMap Nominatim; please keep to light personal use per their usage policy)

## Customise

Map settings are in `src/components/MapView.jsx`:

- `START.center` – starting `[lng, lat]`
- `START.zoom` / `START.pitch` / `START.bearing` – starting view
- `STYLE_URL` – any MapLibre style (CARTO Dark Matter by default)
- The `tick` function – rotation speed and tilt sway

Pages live in `src/pages/` (`Landing.jsx`, `MapPage.jsx`); routing is a tiny hash router in `src/App.jsx`.
