import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// ─── Data URLs ───────────────────────────────────────────────────────────────
// The L-TOWN synthetic network uses normalised coordinates centred at (0, 0).
// The CARTO basemap is used (OpenStreetMap data) – the map is centred at (0, 0)
// so the pipe/leak layers land on the correct location on the basemap.
const STYLE_URL     = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const PIPE_DATA_URL = '/data/pipes.geojson'
const LEAK_DATA_URL = '/data/leaks.geojson'
const PRIORITIES_URL = '/data/final_intervention_priorities.json'
const MODEL_PERF_URL  = '/data/model_performance.json'

// Open at world view; L-TOWN data loads silently in the background.
const START = { center: [10, 20], zoom: 2, pitch: 0, bearing: 0 }

const LAYER_IDS = {
  pipes:     'water-pipes-line',
  pipesHL:   'water-pipes-hl',    // highlighted leak pipes
  leaks:     'water-leak-points',
}

// ─── 3-D buildings ───────────────────────────────────────────────────────────
function add3DBuildings(map) {
  const layers = map.getStyle()?.layers ?? []
  const flat = layers.find((l) => l['source-layer'] === 'building' && l.source)
  if (!flat) return
  if (map.getLayer('buildings-3d')) return
  map.setLayoutProperty(flat.id, 'visibility', 'none')
  const firstLabel = layers.find((l) => l.type === 'symbol')
  map.addLayer({
    id: 'buildings-3d',
    type: 'fill-extrusion',
    source: flat.source,
    'source-layer': 'building',
    minzoom: 14,
    paint: {
      'fill-extrusion-color': [
        'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 10],
        0, '#6b4a5a', 40, '#9fc3dc', 110, '#d7efff', 250, '#e9f056',
      ],
      'fill-extrusion-height':  ['coalesce', ['get', 'render_height'],     10],
      'fill-extrusion-base':    ['coalesce', ['get', 'render_min_height'],  0],
      'fill-extrusion-opacity': 0.92,
    },
  }, firstLabel?.id)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function loadJSON(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`)
  return r.json()
}

// ─── OSM Overpass ─────────────────────────────────────────────────────────────
// All OSM pipelines render as blue lines
const OSM_PIPE_COLOR = '#4fa8ff'

// ─── Global pipeline overlay via OpenInfraMap vector tiles ──────────────────────────────
// OpenInfraMap serves pre-processed OSM infrastructure as global vector tiles.
// No per-viewport fetching needed — works at every zoom level worldwide.
function addGlobalPipelineLayer(map) {
  if (map.getSource('openinframap')) return   // already added
  map.addSource('openinframap', {
    type: 'vector',
    url:  'https://tiles.openinframap.org/tilejson/2.json',
  })
  const lineStyle = {
    type: 'line',
    source: 'openinframap',
    paint: {
      'line-color': OSM_PIPE_COLOR,
      'line-opacity': 0.8,
      'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.7, 10, 1.5, 16, 3.5],
    },
  }
  // Oil / gas / fuel pipelines (man_made=pipeline)
  map.addLayer({ id: 'osm-pipes-main',  'source-layer': 'pipeline',       ...lineStyle })
  // Water distribution mains
  map.addLayer({ id: 'osm-pipes-water', 'source-layer': 'water_pipeline',  ...lineStyle })

  // Click popup for both layers
  ;['osm-pipes-main', 'osm-pipes-water'].forEach((layerId) => {
    map.on('click', layerId, (e) => {
      const f = e.features?.[0]
      if (!f) return
      const p = f.properties
      const content = document.createElement('div')
      content.className = 'network-popup'
      content.innerHTML = `<h3>${p.name || 'OSM Pipeline'}</h3>
        <dl>
          <dt>Substance</dt><dd>${p.substance || p.type || '—'}</dd>
          <dt>Operator</dt><dd>${p.operator || '—'}</dd>
        </dl>`
      new maplibregl.Popup({ maxWidth: '260px' }).setLngLat(e.lngLat).setDOMContent(content).addTo(map)
    })
    map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = '' })
  })
}

function collectCoordinates(value, result = []) {
  if (!Array.isArray(value)) return result
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
    result.push([value[0], value[1]])
    return result
  }
  value.forEach((child) => collectCoordinates(child, result))
  return result
}

function fitToNetwork(map, ...collections) {
  const points = collections.flatMap((col) =>
    (col?.features ?? []).flatMap((f) => collectCoordinates(f.geometry?.coordinates))
  )
  if (!points.length) return
  const bounds = points.reduce(
    (b, p) => b.extend(p),
    new maplibregl.LngLatBounds(points[0], points[0])
  )
  map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 900 })
}

function fmtCost(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  if (n >= 1e6) return `₹${(n / 1e6).toFixed(1)}M`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`
  return `₹${n.toLocaleString('en-IN')}`
}

function fmtML(v) {
  const n = Number(v)
  return Number.isFinite(n) ? `${n.toFixed(3)} ML/d` : '—'
}

function recommendationColor(rec) {
  switch (rec) {
    case 'Critical Water Loss': return '#ff3b3b'
    case 'High Water Loss':     return '#ff8c42'
    case 'Investigate':         return '#ffd166'
    case 'Cost Efficient':      return '#4cc38a'
    default:                    return '#e9f056'
  }
}

function buildPopupContent(properties, heading) {
  const el = document.createElement('div')
  el.className = 'network-popup'
  const h = document.createElement('h3')
  h.textContent = heading
  el.appendChild(h)
  if (properties.Recommendation) {
    const badge = document.createElement('span')
    badge.className = 'popup-badge'
    badge.style.background = recommendationColor(properties.Recommendation)
    badge.textContent = properties.Recommendation
    el.appendChild(badge)
  }
  const dl = document.createElement('dl')
  const KEYS = [
    'Leak_Location', 'Start_Node', 'End_Node',
    'Predicted_Loss_ML_per_day', 'Recoverable_ML_per_day',
    'Repair_Cost_INR', 'Recoverable_ML_per_1Lakh',
    'Network_Region', 'Region_Priority',
  ]
  KEYS.forEach((key) => {
    const val = properties[key]
    if (val == null || val === '') return
    const dt = document.createElement('dt')
    dt.textContent = key.replaceAll('_', ' ')
    const dd = document.createElement('dd')
    if (key === 'Repair_Cost_INR') dd.textContent = fmtCost(val)
    else if (key.includes('ML_per')) dd.textContent = fmtML(val)
    else dd.textContent = String(val)
    dl.append(dt, dd)
  })
  el.appendChild(dl)
  return el
}

// ─── Map layer setup ──────────────────────────────────────────────────────────
function addNetworkLayers(map, pipes, leaks) {
  // Pipe network
  if (!map.getSource('water-pipes')) {
    map.addSource('water-pipes', { type: 'geojson', data: pipes })
    map.addLayer({
      id: LAYER_IDS.pipes,
      type: 'line',
      source: 'water-pipes',
      paint: {
        'line-color': '#62c9ff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 14, 2.8],
        'line-opacity': 0.82,
      },
    })
    // Highlighted (leak) pipes
    map.addLayer({
      id: LAYER_IDS.pipesHL,
      type: 'line',
      source: 'water-pipes',
      filter: ['in', 'Pipe', ''],   // empty until a priority list is loaded
      paint: {
        'line-color': '#ff3b3b',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.8, 14, 4.5],
        'line-opacity': 0.95,
        'line-blur': 0.5,
      },
    })
  }

  // Leak candidates (circles)
  if (!map.getSource('water-leaks')) {
    map.addSource('water-leaks', { type: 'geojson', data: leaks })
    map.addLayer({
      id: LAYER_IDS.leaks,
      type: 'circle',
      source: 'water-leaks',
      paint: {
        'circle-radius': [
          'interpolate', ['linear'],
          ['coalesce', ['to-number', ['get', 'Predicted_Loss_ML_per_day']], 0],
          0, 5, 0.4, 8, 1.4, 16,
        ],
        'circle-color': [
          'match', ['get', 'Recommendation'],
          'Critical Water Loss', '#ff3b3b',
          'High Water Loss',     '#ff8c42',
          'Investigate',         '#ffd166',
          'Cost Efficient',      '#4cc38a',
          '#e9f056',
        ],
        'circle-stroke-color': '#fff7d6',
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.96,
      },
    })
  }

  // Click handlers
  map.on('click', LAYER_IDS.leaks, (e) => {
    const f = e.features?.[0]
    if (!f) return
    new maplibregl.Popup({ closeButton: true, maxWidth: '320px' })
      .setLngLat(e.lngLat)
      .setDOMContent(buildPopupContent(f.properties, f.properties.Leak_Location || 'Leak candidate'))
      .addTo(map)
  })
  map.on('click', LAYER_IDS.pipes, (e) => {
    const f = e.features?.[0]
    if (!f) return
    new maplibregl.Popup({ closeButton: true, maxWidth: '280px' })
      .setLngLat(e.lngLat)
      .setDOMContent(buildPopupContent(f.properties, f.properties.Pipe || 'Water pipe'))
      .addTo(map)
  })
  for (const id of [LAYER_IDS.pipes, LAYER_IDS.leaks]) {
    map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = '' })
  }
}

// ─── Summary stats ────────────────────────────────────────────────────────────
function buildSummary(priorities, modelPerf) {
  const total      = priorities.length
  const critical   = priorities.filter((p) => p.Recommendation === 'Critical Water Loss').length
  const high       = priorities.filter((p) => p.Recommendation === 'High Water Loss').length
  const totalLoss  = priorities.reduce((s, p) => s + (Number(p.Predicted_Loss_ML_per_day) || 0), 0)
  const totalCost  = priorities.reduce((s, p) => s + (Number(p.Repair_Cost_INR) || 0), 0)

  let avgImprovement = 0
  if (modelPerf?.length) {
    const valid = modelPerf.filter((r) => Number.isFinite(Number(r['Improvement_%'])))
    if (valid.length) {
      avgImprovement = valid.reduce((s, r) => s + Number(r['Improvement_%']), 0) / valid.length
    }
  }

  return { total, critical, high, totalLoss, totalCost, avgImprovement }
}

// ─── Global scattered leak replicas ───────────────────────────────────────────────────────────
// Deterministic seeded random so points are identical on every page load
function seededRand(s) { const x = Math.sin(s + 1) * 10000; return x - Math.floor(x) }

// [minLng, minLat, maxLng, maxLat] for inhabited regions
const WORLD_REGIONS = [
  [-125,  25,  -65,  50],  // North America
  [  -8,  36,   32,  60],  // Europe
  [  28,  25,   55,  42],  // Middle East
  [  68,  10,  140,  50],  // Asia
  [ -80, -55,  -35,  12],  // South America
  [ -18, -35,   52,  38],  // Africa
  [ 112, -40,  154,  -15], // Australia
]

function buildScatteredLeaks(sourceFeatures) {
  const features = []
  const CLUSTERS  = 120   // clusters (= simulated cities worldwide)
  const PER_CLUSTER = 5   // leak incidents per city

  for (let c = 0; c < CLUSTERS; c++) {
    const region  = WORLD_REGIONS[Math.floor(seededRand(c * 7) * WORLD_REGIONS.length)]
    const [mnLng, mnLat, mxLng, mxLat] = region
    const clLng   = mnLng + seededRand(c * 13) * (mxLng - mnLng)
    const clLat   = mnLat + seededRand(c * 17) * (mxLat - mnLat)

    for (let k = 0; k < PER_CLUSTER; k++) {
      const src   = sourceFeatures[Math.floor(seededRand(c * 100 + k * 3) * sourceFeatures.length)]
      const lng   = clLng + (seededRand(c * 200 + k * 11) - 0.5) * 0.3
      const lat   = clLat + (seededRand(c * 300 + k * 17) - 0.5) * 0.3
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { ...src.properties, _replica: true, _city: c },
      })
    }
  }
  return { type: 'FeatureCollection', features }
}

function addScatteredLayer(map, leaks) {
  if (map.getSource('scattered-leaks') || !leaks?.features?.length) return
  const scattered = buildScatteredLeaks(leaks.features)
  map.addSource('scattered-leaks', { type: 'geojson', data: scattered, cluster: true, clusterRadius: 40, clusterMaxZoom: 7 })

  // Clustered circles (world zoom)
  map.addLayer({
    id: 'scattered-clusters',
    type: 'circle',
    source: 'scattered-leaks',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step', ['get', 'point_count'],
        '#ffd166', 3,
        '#ff8c42', 6,
        '#ff3b3b',
      ],
      'circle-radius': ['step', ['get', 'point_count'], 10, 3, 14, 6, 18],
      'circle-stroke-color': '#fff7d6',
      'circle-stroke-width': 1.5,
      'circle-opacity': 0.88,
    },
  })

  // Cluster count labels
  map.addLayer({
    id: 'scattered-count',
    type: 'symbol',
    source: 'scattered-leaks',
    filter: ['has', 'point_count'],
    layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 11 },
    paint: { 'text-color': '#1a1020' },
  })

  // Individual dots (zoomed in)
  map.addLayer({
    id: 'scattered-points',
    type: 'circle',
    source: 'scattered-leaks',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 5, 10, 8, 14, 12],
      'circle-color': [
        'match', ['get', 'Recommendation'],
        'Critical Water Loss', '#ff3b3b',
        'High Water Loss',     '#ff8c42',
        'Investigate',         '#ffd166',
        'Cost Efficient',      '#4cc38a',
        '#e9f056',
      ],
      'circle-stroke-color': '#fff7d6',
      'circle-stroke-width': 1.5,
      'circle-opacity': 0.92,
    },
  })

  // Click popup — rich incident card
  map.on('click', 'scattered-points', (e) => {
    const f = e.features?.[0]
    if (!f) return
    const p = f.properties
    const rec = p.Recommendation || 'Unknown'
    const colors = {
      'Critical Water Loss': { bg: '#ff3b3b', text: '#fff', bar: '#ff3b3b' },
      'High Water Loss':     { bg: '#ff8c42', text: '#fff', bar: '#ff8c42' },
      'Investigate':         { bg: '#ffd166', text: '#1a1020', bar: '#ffd166' },
      'Cost Efficient':      { bg: '#4cc38a', text: '#1a1020', bar: '#4cc38a' },
    }
    const palette = colors[rec] || { bg: '#e9f056', text: '#1a1020', bar: '#e9f056' }
    const loss = Number(p.Predicted_Loss_ML_per_day) || 0
    const maxLoss = 1.4
    const barPct = Math.min(100, (loss / maxLoss) * 100).toFixed(1)
    const costFmt = (v) => {
      const n = Number(v); if (!n) return '—'
      if (n >= 1e7) return `₹${(n/1e7).toFixed(2)}Cr`
      if (n >= 1e5) return `₹${(n/1e5).toFixed(1)}L`
      return `₹${n.toLocaleString('en-IN')}`
    }

    const el = document.createElement('div')
    el.className = 'incident-popup'
    el.innerHTML = `
      <div class="incident-header" style="background:${palette.bg};color:${palette.text}">
        <span class="incident-icon">${rec === 'Critical Water Loss' ? '🔴' : rec === 'High Water Loss' ? '🟠' : rec === 'Investigate' ? '🟡' : '🟢'}</span>
        <div>
          <div class="incident-rec">${rec}</div>
          <div class="incident-pipe">${p.Leak_Location || p.Pipe || 'Simulated incident'}</div>
        </div>
      </div>
      <div class="incident-body">
        <div class="incident-stat">
          <span class="istat-label">Predicted water loss</span>
          <span class="istat-value">${loss.toFixed(3)} ML/day</span>
        </div>
        <div class="incident-bar-wrap">
          <div class="incident-bar" style="width:${barPct}%;background:${palette.bar}"></div>
        </div>
        <div class="incident-stat">
          <span class="istat-label">Recoverable</span>
          <span class="istat-value">${Number(p.Recoverable_ML_per_day||0).toFixed(3)} ML/day</span>
        </div>
        <div class="incident-stat">
          <span class="istat-label">Est. repair cost</span>
          <span class="istat-value">${costFmt(p.Repair_Cost_INR)}</span>
        </div>
        <div class="incident-stat">
          <span class="istat-label">Network region</span>
          <span class="istat-value">${p.Network_Region || '—'}</span>
        </div>
        <div class="incident-stat">
          <span class="istat-label">Region priority</span>
          <span class="istat-value">#${p.Region_Priority || '—'}</span>
        </div>
        <div class="incident-note">⚠ Simulated replica of L-TOWN dataset</div>
      </div>`

    new maplibregl.Popup({ maxWidth: '300px', className: 'incident-popup-wrap' })
      .setLngLat(e.lngLat)
      .setDOMContent(el)
      .addTo(map)
  })

  // Clicking a cluster zooms into it
  map.on('click', 'scattered-clusters', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['scattered-clusters'] })
    const clusterId = features[0]?.properties?.cluster_id
    if (!clusterId) return
    map.getSource('scattered-leaks').getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return
      map.easeTo({ center: e.lngLat, zoom: zoom + 0.5, duration: 500 })
    })
  })

  for (const id of ['scattered-points', 'scattered-clusters']) {
    map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = '' })
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MapView({ activeTab }) {
  const container   = useRef(null)
  const mapRef      = useRef(null)
  const spinRef     = useRef(false)

  const [showPipes,      setShowPipes]      = useState(true)
  const [showLeaks,      setShowLeaks]      = useState(true)
  const [showOSM,        setShowOSM]        = useState(true)
  const [showScattered,  setShowScattered]  = useState(true)
  const [dataStatus,   setDataStatus]   = useState('Loading network data…')
  const [priorities,   setPriorities]   = useState([])
  const [modelPerf,    setModelPerf]    = useState([])
  const [summary,      setSummary]      = useState(null)
  const [selectedPipe, setSelectedPipe] = useState(null)
  const [spinning,     setSpinning]     = useState(false)
  const [pitch,        setPitch]        = useState(START.pitch)
  // Search state
  const [query,        setQuery]        = useState('')
  const [results,      setResults]      = useState([])
  const [searching,    setSearching]    = useState(false)
  const [searchMsg,    setSearchMsg]    = useState('')
  const markerRef = useRef(null)

  // ── Initialise map ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      ...START,
      maxPitch: 85,
      antialias: true,
      scrollZoom: { wheelZoomRate: 1 / 200 }, // default is 1/450 — doubled speed
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')

    let cancelled = false

    const stopSpin = () => { spinRef.current = false; setSpinning(false) }
    map.on('dragstart',    stopSpin)
    map.on('pitchstart',   (e) => e.originalEvent && stopSpin())
    map.on('rotatestart',  (e) => e.originalEvent && stopSpin())
    map.on('pitch',        () => setPitch(Math.round(map.getPitch())))

    map.on('load', async () => {
      add3DBuildings(map)
      addGlobalPipelineLayer(map)
      // Re-attempt buildings on moveend so they appear when flying to a city
      map.on('moveend', () => add3DBuildings(map))
      try {
        const [pipes, leaks, prios, perf] = await Promise.all([
          loadJSON(PIPE_DATA_URL),
          loadJSON(LEAK_DATA_URL),
          loadJSON(PRIORITIES_URL).catch(() => []),
          loadJSON(MODEL_PERF_URL).catch(() => []),
        ])
        if (cancelled) return

        addNetworkLayers(map, pipes, leaks)
        addScatteredLayer(map, leaks)
        // Don't auto-fit to L-TOWN — user opened to world view intentionally

        setPriorities(prios)
        setModelPerf(perf)
        setSummary(buildSummary(prios, perf))

        // Highlight priority pipe IDs on the pipe layer
        if (prios.length && map.getLayer(LAYER_IDS.pipesHL)) {
          const ids = prios.map((p) => p.Pipe || p.Leak_Location).filter(Boolean)
          map.setFilter(LAYER_IDS.pipesHL, ['in', 'Pipe', ...ids])
        }

        setDataStatus(
          `${pipes.features.length.toLocaleString()} pipes · ` +
          `${leaks.features.length.toLocaleString()} leak candidates · ` +
          `${prios.length} priorities`
        )
      } catch (err) {
        if (cancelled) return
        console.warn('Network data load error:', err)
        setDataStatus('⚠ Could not load network data. Check public/data/ folder.')
      }
    })


    return () => {
      cancelled = true
      map.remove()
    }
  }, [])

  // ── Layer visibility ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      if (map.getLayer(LAYER_IDS.pipes))       map.setLayoutProperty(LAYER_IDS.pipes,        'visibility', showPipes    ? 'visible' : 'none')
      if (map.getLayer(LAYER_IDS.pipesHL))     map.setLayoutProperty(LAYER_IDS.pipesHL,      'visibility', showPipes    ? 'visible' : 'none')
      if (map.getLayer(LAYER_IDS.leaks))       map.setLayoutProperty(LAYER_IDS.leaks,        'visibility', showLeaks    ? 'visible' : 'none')
      if (map.getLayer('osm-pipes-main'))      map.setLayoutProperty('osm-pipes-main',       'visibility', showOSM      ? 'visible' : 'none')
      if (map.getLayer('osm-pipes-water'))     map.setLayoutProperty('osm-pipes-water',      'visibility', showOSM      ? 'visible' : 'none')
      if (map.getLayer('scattered-clusters'))  map.setLayoutProperty('scattered-clusters',   'visibility', showScattered ? 'visible' : 'none')
      if (map.getLayer('scattered-count'))     map.setLayoutProperty('scattered-count',      'visibility', showScattered ? 'visible' : 'none')
      if (map.getLayer('scattered-points'))    map.setLayoutProperty('scattered-points',     'visibility', showScattered ? 'visible' : 'none')
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [showPipes, showLeaks, showOSM, showScattered])

  // ── Spin / tilt controls ────────────────────────────────────────────────────
  const toggleSpin = () => {
    spinRef.current = !spinRef.current
    setSpinning(spinRef.current)
    if (spinRef.current) {
      let last = performance.now()
      let t = 0
      const animate = (now) => {
        const map = mapRef.current
        if (!map || !spinRef.current) return
        const dt = (now - last) / 1000
        last = now
        t += dt
        map.setBearing(map.getBearing() + 5 * dt)
        map.setPitch(52 + Math.sin(t * 0.4) * 8)
        requestAnimationFrame(animate)
      }
      requestAnimationFrame(animate)
    }
  }

  const onPitch = (e) => {
    spinRef.current = false
    setSpinning(false)
    const value = Number(e.target.value)
    setPitch(value)
    mapRef.current?.setPitch(value)
  }

  // ── Fly to a priority pipe ──────────────────────────────────────────────────
  const flyToPipe = useCallback((p) => {
    const map = mapRef.current
    if (!map) return
    setSelectedPipe(p.Pipe || p.Leak_Location)
  }, [])

  // ── Search (Nominatim) ──────────────────────────────────────────────────────
  const runSearch = async (e) => {
    e.preventDefault()
    const term = query.trim()
    if (!term) return
    setSearching(true); setSearchMsg(''); setResults([])
    try {
      const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=' + encodeURIComponent(term)
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!data.length) setSearchMsg('No places found.')
      setResults(data)
    } catch { setSearchMsg('Search failed. Check your connection.') }
    finally { setSearching(false) }
  }

  const goTo = (place) => {
    const map = mapRef.current
    if (!map) return
    spinRef.current = false; setSpinning(false)
    const lngLat = [Number(place.lon), Number(place.lat)]
    markerRef.current?.remove()
    markerRef.current = new maplibregl.Marker({ color: '#e9f056' }).setLngLat(lngLat).addTo(map)
    map.flyTo({ center: lngLat, zoom: 14, pitch: 45, bearing: -15, duration: 1800, essential: true })
    setResults([])
    setQuery(place.display_name.split(',').slice(0, 2).join(','))
  }

  const recColor = (rec) => ({
    'Critical Water Loss': '#ff3b3b',
    'High Water Loss':     '#ff8c42',
    'Investigate':         '#ffd166',
    'Cost Efficient':      '#4cc38a',
  }[rec] || '#e9f056')

  return (
    <div className="map-window">
      {/* ── Map canvas (always mounted) ── */}
      <div ref={container} className="map-canvas" />

      {/* ── Search bar ── */}
      {activeTab === 'map' && (
        <div className="map-search">
          <form onSubmit={runSearch}>
            <input
              type="search" value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a city or address…"
              aria-label="Search for a place"
            />
            <button type="submit" disabled={searching}>{searching ? '…' : 'Go'}</button>
          </form>
          {(results.length > 0 || searchMsg) && (
            <ul className="search-results">
              {results.map((p) => (
                <li key={p.place_id}>
                  <button type="button" onClick={() => goTo(p)}>{p.display_name}</button>
                </li>
              ))}
              {searchMsg && <li className="search-msg">{searchMsg}</li>}
            </ul>
          )}
        </div>
      )}

      {/* ── Map HUD — compact layer list only ── */}
      {activeTab === 'map' && (
        <div className="map-hud">
          <p className="map-layer-heading">Layers</p>
          <label className="map-layer-option">
            <input type="checkbox" checked={showPipes} onChange={(e) => setShowPipes(e.target.checked)} />
            <span className="layer-swatch layer-pipes" />L-TOWN network
          </label>
          <label className="map-layer-option">
            <input type="checkbox" checked={showLeaks} onChange={(e) => setShowLeaks(e.target.checked)} />
            <span className="layer-swatch layer-leaks" />Leak candidates
          </label>
          <label className="map-layer-option">
            <input type="checkbox" checked={showOSM} onChange={(e) => setShowOSM(e.target.checked)} />
            <span className="layer-swatch layer-osm" />OSM pipelines
          </label>
          <label className="map-layer-option">
              <input type="checkbox" checked={showScattered} onChange={(e) => setShowScattered(e.target.checked)} />
              <span className="layer-swatch layer-scattered" />Replica incidents
            </label>
          <p className="map-layer-heading" style={{ marginTop: 8 }}>Leak severity</p>
          <span className="legend-row"><i className="legend-dot critical" />Critical</span>
          <span className="legend-row"><i className="legend-dot high" />High</span>
          <span className="legend-row"><i className="legend-dot investigate" />Investigate</span>
          <span className="legend-row"><i className="legend-dot efficient" />Cost efficient</span>
          <p className="map-data-status" role="status">{dataStatus}</p>
        </div>
      )}

      {/* ── Bottom-right controls: tilt + spin ── */}
      {activeTab === 'map' && (
        <div className="map-controls-br">
          <label className="tilt-control">Tilt {pitch}°
            <input type="range" min="0" max="85" value={pitch} onChange={onPitch} />
          </label>
          <button onClick={toggleSpin}>{spinning ? 'Pause' : 'Auto-rotate'}</button>
        </div>
      )}

      {/* ── Pipeline model panel (shown in pipeline tab) ── */}
      {activeTab === 'pipeline' && (
        <div className="pipeline-panel">
          <div className="pipeline-header">
            <h2>ML Leak Detection Pipeline</h2>
            <p className="pipeline-sub">
              Gradient Boosting model trained on SCADA pressure / flow data. 
              Results from <em>L-TOWN Real</em> dataset.
            </p>
          </div>

          {summary && (
            <div className="pipeline-kpis">
              <div className="kpi-card">
                <div className="kpi-value">{summary.total}</div>
                <div className="kpi-label">Pipes analysed</div>
              </div>
              <div className="kpi-card kpi-critical">
                <div className="kpi-value">{summary.critical}</div>
                <div className="kpi-label">Critical</div>
              </div>
              <div className="kpi-card kpi-high">
                <div className="kpi-value">{summary.high}</div>
                <div className="kpi-label">High risk</div>
              </div>
              <div className="kpi-card kpi-green">
                <div className="kpi-value">{summary.avgImprovement.toFixed(0)}%</div>
                <div className="kpi-label">Avg. improvement vs baseline</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-value">{summary.totalLoss.toFixed(2)}</div>
                <div className="kpi-label">ML/day predicted loss</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-value">{fmtCost(summary.totalCost)}</div>
                <div className="kpi-label">Total repair cost est.</div>
              </div>
            </div>
          )}

          <div className="pipeline-section">
            <h3>Intervention Priorities</h3>
            <p className="pipeline-note">Ranked by predicted water loss. Click a row to highlight on the map.</p>
            <div className="priority-table-wrap">
              <table className="priority-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Pipe</th>
                    <th>Region</th>
                    <th>Predicted Loss</th>
                    <th>Repair Cost</th>
                    <th>Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {priorities.map((p, i) => (
                    <tr
                      key={p.Pipe || p.Leak_Location}
                      className={`priority-row${selectedPipe === (p.Pipe || p.Leak_Location) ? ' selected' : ''}`}
                      onClick={() => flyToPipe(p)}
                    >
                      <td>{i + 1}</td>
                      <td><code>{p.Pipe || p.Leak_Location}</code></td>
                      <td>{p.Network_Region}</td>
                      <td>{fmtML(p.Predicted_Loss_ML_per_day)}</td>
                      <td>{fmtCost(p.Repair_Cost_INR)}</td>
                      <td>
                        <span
                          className="rec-badge"
                          style={{ background: recColor(p.Recommendation) }}
                        >{p.Recommendation}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {modelPerf.length > 0 && (
            <div className="pipeline-section">
              <h3>Model Performance per Pipe</h3>
              <p className="pipeline-note">MAE comparison vs. naïve baseline (predict mean).</p>
              <div className="priority-table-wrap">
                <table className="priority-table">
                  <thead>
                    <tr>
                      <th>Pipe</th>
                      <th>Model MAE</th>
                      <th>Baseline MAE</th>
                      <th>Improvement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelPerf.map((r) => {
                      const imp = Number(r['Improvement_%'])
                      return (
                        <tr key={r.Leak_Location}>
                          <td><code>{r.Leak_Location}</code></td>
                          <td>{Number(r.Model_MAE).toFixed(4)}</td>
                          <td>{Number(r.Baseline_MAE).toFixed(4)}</td>
                          <td style={{ color: imp > 50 ? '#4cc38a' : imp > 0 ? '#ffd166' : '#ff8c42' }}>
                            {imp.toFixed(1)}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
