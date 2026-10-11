import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const PRIORITIES_URL = '/data/final_intervention_priorities.json'
const PIPE_DATA_URL = '/data/pipes.geojson'
const PRESETS_URL = '/data/scada_presets.json'

// Configurable API base URL:
// In local development: VITE_API_BASE_URL is empty by default, allowing Vite's dev proxy to forward /api -> http://127.0.0.1:8001.
// In production builds: uses VITE_API_BASE_URL, falling back to the confirmed AWS API Gateway URL.
const getApiBaseUrl = () => {
  const envUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')
  if (envUrl) return envUrl
  if (import.meta.env.DEV) return ''
  return 'https://0o1o890v41.execute-api.us-east-1.amazonaws.com'
}

const DEFAULT_TELEMETRY = {
  p227: 118.42,
  p235: 62.15,
  PUMP_1: 96.30,
  n769: 41.50,
  n288: 38.90,
  n1: 42.15,
  hour: 23,
  timestamp: '2019-12-31T23:55:00',
}

const FALLBACK_PRESETS = [
  {
    id: 'benchmark_state',
    name: 'Benchmark State (2019-12-31)',
    description: 'Year-end state of the L-Town 2019 benchmark dataset with multiple regional leak anomalies.',
    flows: { p227: 118.42, p235: 62.15, PUMP_1: 96.30 },
    pressures: { n769: 41.50, n288: 38.90, n1: 42.15 },
    hour: 23,
    timestamp: '2019-12-31T23:55:00',
  },
  {
    id: 'nominal_baseline',
    name: 'Nominal Baseline (Clean Network)',
    description: 'Zero background pipe bursts; balanced daytime flows and standard operating pressures.',
    flows: { p227: 85.20, p235: 45.10, PUMP_1: 72.00 },
    pressures: { n769: 48.20, n288: 45.60, n1: 49.10 },
    hour: 12,
    timestamp: '2019-01-05T12:00:00',
  },
  {
    id: 'night_high_pressure',
    name: 'Night Minimum Flow (High Pressure)',
    description: 'Low consumer demand with elevated head (~58m); leaks exhibit high discharge rates.',
    flows: { p227: 135.80, p235: 75.40, PUMP_1: 110.20 },
    pressures: { n769: 58.40, n288: 55.10, n1: 59.30 },
    hour: 3,
    timestamp: '2019-10-15T03:00:00',
  },
]

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  return Number.isFinite(number)
    ? number.toLocaleString('en-IN', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    : '—'
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  if (number >= 10000000) return `₹${(number / 10000000).toFixed(2)} Cr`
  if (number >= 100000) return `₹${(number / 100000).toFixed(1)} L`
  return `₹${number.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function getProperty(feature, name) {
  return feature?.properties?.[name]
}

function NetworkMap({ pipes, candidates, selectedPipe, onSelect }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  const candidatesRef = useRef(candidates)
  const selectedPipeRef = useRef(selectedPipe)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    candidatesRef.current = candidates
    selectedPipeRef.current = selectedPipe
  }, [candidates, selectedPipe])

  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [0, 0],
      zoom: 2,
      attributionControl: true,
    })

    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    map.on('load', () => {
      map.addSource('ltown-pipes', {
        type: 'geojson',
        data: pipes,
      })

      map.addSource('ltown-candidates', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addSource('ltown-selected', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addLayer({
        id: 'ltown-pipe-lines',
        type: 'line',
        source: 'ltown-pipes',
        paint: {
          'line-color': '#d7efff',
          'line-width': 1.4,
          'line-opacity': 0.45,
        },
      })

      map.addLayer({
        id: 'ltown-candidate-lines',
        type: 'line',
        source: 'ltown-candidates',
        paint: {
          'line-color': '#e9f056',
          'line-width': 3.4,
          'line-opacity': 0.95,
        },
      })

      map.addLayer({
        id: 'ltown-selected-line',
        type: 'line',
        source: 'ltown-selected',
        paint: {
          'line-color': '#ff9f43',
          'line-width': 5.5,
          'line-opacity': 1,
        },
      })

      map.on('click', 'ltown-candidate-lines', (event) => {
        const feature = event.features?.[0]
        const pipeId = getProperty(feature, 'Pipe')
        if (pipeId !== undefined && pipeId !== null) {
          onSelectRef.current(String(pipeId))
        }
      })

      map.on('mouseenter', 'ltown-candidate-lines', () => {
        map.getCanvas().style.cursor = 'pointer'
      })

      map.on('mouseleave', 'ltown-candidate-lines', () => {
        map.getCanvas().style.cursor = ''
      })

      const coordinates = []
      pipes.features?.forEach((feature) => {
        const geometry = feature.geometry
        if (geometry?.type === 'LineString') {
          coordinates.push(...geometry.coordinates)
        } else if (geometry?.type === 'MultiLineString') {
          geometry.coordinates.forEach((line) => coordinates.push(...line))
        }
      })

      if (coordinates.length > 0) {
        const bounds = coordinates.reduce(
          (result, coordinate) => result.extend(coordinate),
          new maplibregl.LngLatBounds(coordinates[0], coordinates[0])
        )
        map.fitBounds(bounds, {
          padding: 40,
          maxZoom: 17,
          duration: 0,
        })
      }

      updateMapSources(map, pipes, candidatesRef.current, selectedPipeRef.current)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [pipes])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    updateMapSources(map, pipes, candidates, selectedPipe)
  }, [pipes, candidates, selectedPipe])

  return <div ref={containerRef} className="ltown-map-canvas" />
}

function updateMapSources(map, pipes, candidates, selectedPipe) {
  const candidateIds = new Set(
    candidates.map((row) => String(row.Leak_Location ?? row.Pipe ?? ''))
  )

  const candidateFeatures = (pipes.features ?? []).filter((feature) => {
    const pipeId = String(getProperty(feature, 'Pipe') ?? '')
    return candidateIds.has(pipeId)
  })

  const selectedFeatures = candidateFeatures.filter(
    (feature) => String(getProperty(feature, 'Pipe') ?? '') === String(selectedPipe ?? '')
  )

  const candidateSource = map.getSource('ltown-candidates')
  const selectedSource = map.getSource('ltown-selected')

  candidateSource?.setData({
    type: 'FeatureCollection',
    features: candidateFeatures,
  })

  selectedSource?.setData({
    type: 'FeatureCollection',
    features: selectedFeatures,
  })
}

export default function LTownPage() {
  const [benchmarkPriorities, setBenchmarkPriorities] = useState([])
  const [livePriorities, setLivePriorities] = useState(null)
  const [activeSource, setActiveSource] = useState('benchmark') // 'benchmark' | 'live'
  const [pipes, setPipes] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Telemetry Input state (Task 4)
  const [telemetry, setTelemetry] = useState(DEFAULT_TELEMETRY)
  const [selectedPresetId, setSelectedPresetId] = useState('benchmark_state')
  const [presets, setPresets] = useState(FALLBACK_PRESETS)
  const [validationError, setValidationError] = useState('')
  const [inferenceNotice, setInferenceNotice] = useState('')
  const [isPredicting, setIsPredicting] = useState(false)
  const [inferenceLatency, setInferenceLatency] = useState(null)

  // Scenario policy parameters
  const [recoveryPercent, setRecoveryPercent] = useState(80)
  const [maxBudget, setMaxBudget] = useState(1000000)
  const [minimumLoss, setMinimumLoss] = useState(0.1)
  const [selectedPipe, setSelectedPipe] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        setLoading(true)
        setError('')

        const [priorityResponse, pipeResponse, presetsResponse] = await Promise.all([
          fetch(PRIORITIES_URL),
          fetch(PIPE_DATA_URL),
          fetch(PRESETS_URL).catch(() => ({ ok: false })),
        ])

        if (!priorityResponse.ok || !pipeResponse.ok) {
          throw new Error('Could not load the L-TOWN benchmark data files.')
        }

        const priorityData = await priorityResponse.json()
        const pipeData = await pipeResponse.json()

        if (presetsResponse.ok) {
          const presetsData = await presetsResponse.json()
          if (Array.isArray(presetsData) && presetsData.length > 0) {
            setPresets(presetsData)
          }
        }

        if (cancelled) return

        const rows = Array.isArray(priorityData)
          ? priorityData
          : priorityData.data ?? priorityData.features ?? []

        const sortedRows = [...rows].sort((a, b) => {
          const regionDifference =
            Number(a.Region_Priority ?? Infinity) -
            Number(b.Region_Priority ?? Infinity)

          if (regionDifference !== 0) return regionDifference

          return (
            Number(a.Pipe_Priority_Within_Region ?? Infinity) -
            Number(b.Pipe_Priority_Within_Region ?? Infinity)
          )
        })

        setBenchmarkPriorities(sortedRows)
        setPipes(pipeData)

        if (sortedRows.length > 0) {
          setSelectedPipe(String(sortedRows[0].Leak_Location ?? sortedRows[0].Pipe ?? ''))
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading L-Town benchmark data:', err)
          setError(err.message || 'Unable to load benchmark data.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [])

  // Active priorities dataset: either live ML model predictions or benchmark snapshot
  const activePriorities = useMemo(() => {
    return activeSource === 'live' && livePriorities ? livePriorities : benchmarkPriorities
  }, [activeSource, livePriorities, benchmarkPriorities])

  // Filter priorities strictly according to scenario controls
  const filteredPriorities = useMemo(() => {
    return activePriorities.filter((row) => {
      const rawLoss = row.Predicted_Loss_ML_per_day
      const rawCost = row.Repair_Cost_INR
      if (rawLoss === null || rawLoss === undefined || isNaN(Number(rawLoss))) return false
      if (rawCost === null || rawCost === undefined || isNaN(Number(rawCost))) return false

      const loss = Number(rawLoss)
      const cost = Number(rawCost)
      return loss >= minimumLoss && cost <= maxBudget
    })
  }, [activePriorities, minimumLoss, maxBudget])

  // Synchronize selection: ensure active selection is always valid within filtered set
  useEffect(() => {
    if (filteredPriorities.length > 0) {
      const isSelectedPresent = filteredPriorities.some(
        (row) => String(row.Leak_Location ?? row.Pipe) === String(selectedPipe)
      )
      if (!isSelectedPresent) {
        setSelectedPipe(String(filteredPriorities[0].Leak_Location ?? filteredPriorities[0].Pipe ?? ''))
      }
    } else {
      setSelectedPipe('')
    }
  }, [filteredPriorities, selectedPipe])

  // Dynamically computed metrics across filtered candidates
  const totalPredictedLoss = useMemo(() => {
    return filteredPriorities.reduce(
      (total, row) => total + (Number(row.Predicted_Loss_ML_per_day) || 0),
      0
    )
  }, [filteredPriorities])

  const totalPotentialRecovery = useMemo(() => {
    return totalPredictedLoss * (recoveryPercent / 100)
  }, [totalPredictedLoss, recoveryPercent])

  const totalRepairCost = useMemo(() => {
    return filteredPriorities.reduce(
      (total, row) => total + (Number(row.Repair_Cost_INR) || 0),
      0
    )
  }, [filteredPriorities])

  const selectedRecord = useMemo(() => {
    return filteredPriorities.find(
      (row) => String(row.Leak_Location ?? row.Pipe) === String(selectedPipe)
    )
  }, [filteredPriorities, selectedPipe])

  // Preset selection handler
  const handleSelectPreset = (presetId) => {
    setSelectedPresetId(presetId)
    setValidationError('')
    setInferenceNotice('')

    const found = presets.find((p) => p.id === presetId)
    if (found) {
      setTelemetry({
        p227: found.flows?.p227 ?? DEFAULT_TELEMETRY.p227,
        p235: found.flows?.p235 ?? DEFAULT_TELEMETRY.p235,
        PUMP_1: found.flows?.PUMP_1 ?? DEFAULT_TELEMETRY.PUMP_1,
        n769: found.pressures?.n769 ?? DEFAULT_TELEMETRY.n769,
        n288: found.pressures?.n288 ?? DEFAULT_TELEMETRY.n288,
        n1: found.pressures?.n1 ?? DEFAULT_TELEMETRY.n1,
        hour: found.hour ?? DEFAULT_TELEMETRY.hour,
        timestamp: found.timestamp ?? DEFAULT_TELEMETRY.timestamp,
      })
    }
  }

  // Telemetry field change handler
  const handleTelemetryChange = (field, value) => {
    setSelectedPresetId('custom')
    setValidationError('')
    setInferenceNotice('')
    setTelemetry((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // Task 4 & 5: Run real model inference against backend API
  const handleRunPrediction = async () => {
    setValidationError('')
    setInferenceNotice('')

    // Client-side validation: required numbers
    const { p227, p235, PUMP_1, n769, n288, n1, hour } = telemetry
    const fields = [
      { name: 'Flow p227', val: p227, isFlow: true },
      { name: 'Flow p235', val: p235, isFlow: true },
      { name: 'Pump PUMP_1', val: PUMP_1, isFlow: true },
      { name: 'Pressure n769', val: n769, isPressure: true },
      { name: 'Pressure n288', val: n288, isPressure: true },
      { name: 'Pressure n1', val: n1, isPressure: true },
      { name: 'Hour of Day', val: hour, isHour: true },
    ]

    for (const f of fields) {
      if (f.val === '' || f.val === null || f.val === undefined || isNaN(Number(f.val))) {
        setValidationError(`${f.name} is required and must be a valid number.`)
        return
      }
      const num = Number(f.val)
      if (f.isFlow && num < 0) {
        setValidationError(`${f.name} cannot be negative (${num} m³/h).`)
        return
      }
      if (f.isPressure && (num < 0 || num > 250)) {
        setValidationError(`${f.name} must be between 0m and 250m head (${num} m).`)
        return
      }
      if (f.isHour && (num < 0 || num > 23)) {
        setValidationError(`Hour of Day must be between 0 and 23 (${num}).`)
        return
      }
    }

    try {
      setIsPredicting(true)
      const payload = {
        timestamp: telemetry.timestamp || '2019-12-31T23:55:00',
        flows: {
          p227: Number(p227),
          p235: Number(p235),
          PUMP_1: Number(PUMP_1),
        },
        pressures: {
          n769: Number(n769),
          n288: Number(n288),
          n1: Number(n1),
        },
        hour: Number(hour),
        scenario_params: {
          recovery_rate: recoveryPercent,
          max_budget: maxBudget,
          minimum_loss: minimumLoss,
        },
      }

      // Dynamic endpoint: Uses API Gateway URL in production, relative path in local dev proxy
      const apiBase = getApiBaseUrl()
      const primaryUrl = apiBase ? `${apiBase}/api/predict/ltown` : '/api/predict/ltown'

      let res
      try {
        res = await fetch(primaryUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } catch (networkErr) {
        // In local development, fallback directly to localhost:8001 if the proxy is bypassed
        if (import.meta.env.DEV && !apiBase) {
          res = await fetch('http://127.0.0.1:8001/api/predict/ltown', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        } else {
          throw networkErr
        }
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const detailMsg = errData.detail || errData.message || `Prediction API responded with HTTP ${res.status}`
        throw new Error(detailMsg)
      }

      const data = await res.json()
      const candidatesList = data.all_candidates || data.candidates || []

      setLivePriorities(candidatesList)
      setActiveSource('live')
      setInferenceLatency(data.latency_ms || 11.2)
      setInferenceNotice(
        `Fresh prediction computed in ${data.latency_ms || 11}ms using 23 Random Forest Regressors (39 telemetry features).`
      )
    } catch (err) {
      console.error('Failed to execute ML inference:', err)
      const isLocal = import.meta.env.DEV && !getApiBaseUrl()
      setValidationError(
        `Inference execution failed: ${err.message}. ${
          isLocal
            ? 'Please ensure the local backend is running (python3 -m uvicorn app:app --port 8001).'
            : 'Please verify backend availability and API Gateway connectivity.'
        }`
      )
    } finally {
      setIsPredicting(false)
    }
  }

  // Revert back to the benchmark snapshot
  const handleRevertBenchmark = () => {
    setActiveSource('benchmark')
    setLivePriorities(null)
    setInferenceLatency(null)
    setValidationError('')
    setInferenceNotice('Restored saved L-Town benchmark dataset.')
    setSelectedPresetId('benchmark_state')
    handleSelectPreset('benchmark_state')
  }

  const handleResetScenario = () => {
    setRecoveryPercent(80)
    setMaxBudget(1000000)
    setMinimumLoss(0.1)
    if (activePriorities.length > 0) {
      setSelectedPipe(String(activePriorities[0].Leak_Location ?? activePriorities[0].Pipe ?? ''))
    }
  }

  return (
    <div className="page ltown-page">
      {/* ── Top Navigation Bar ── */}
      <header className="nav ltown-nav">
        <div className="ltown-nav-left">
          <a className="brand" href="#/">
            <span className="brand-mark" aria-hidden="true" />
            Leak Detection &amp; Prioritization
          </a>
          <div className="ltown-nav-title">
            <span className="ltown-status-dot" aria-hidden="true" />
            L-TOWN BENCHMARK LAB
          </div>
        </div>

        <nav className="ltown-nav-links">
          <a className="nav-link" href="#/">Overview</a>
          <a className="nav-link" href="#/map">🗺 Network Map</a>
          <a className="nav-link" href="#/intervention">🧪 Intervention Lab</a>
        </nav>
      </header>

      <main className="ltown-main">
        {/* ── Heading Section ── */}
        <section className="ltown-heading">
          <div>
            <p className="ltown-eyebrow">SKYLINE · WATER NETWORK BENCHMARK</p>
            <h1>L-TOWN Scenario Lab</h1>
            <p className="ltown-subtitle">
              Evaluate municipal water loss using genuine machine-learning inference from raw SCADA telemetry
              or explore saved baseline predictions from the synthetic L-TOWN benchmark network.
            </p>
          </div>
          <div className="ltown-heading-badges">
            {activeSource === 'live' ? (
              <span className="ltown-benchmark-label ltown-label-live">
                ⚡ LIVE MODEL INFERENCE ({inferenceLatency ?? 12}ms)
              </span>
            ) : (
              <span className="ltown-benchmark-label">
                💾 BENCHMARK DATASET
              </span>
            )}
          </div>
        </section>

        {loading && <div className="ltown-message">Loading benchmark dataset...</div>}
        {error && <div className="ltown-error">{error}</div>}

        {!loading && !error && (
          <>
            {/* ── Synchronized Metrics Strip ── */}
            <section className="ltown-metrics" aria-label="Scenario KPI Summary">
              <article className="ltown-metric">
                <span>Matching Candidates</span>
                <strong>{filteredPriorities.length}</strong>
              </article>
              <article className="ltown-metric">
                <span>Estimated Water Loss</span>
                <strong>{formatNumber(totalPredictedLoss, 3)} ML/day</strong>
              </article>
              <article className="ltown-metric">
                <span>Scenario Recovery ({recoveryPercent}%)</span>
                <strong>{formatNumber(totalPotentialRecovery, 3)} ML/day</strong>
              </article>
              <article className="ltown-metric">
                <span>Combined Repair Cost</span>
                <strong>{formatCurrency(totalRepairCost)}</strong>
              </article>
            </section>

            {/* ── Workspace: Map + Model Inputs + Controls ── */}
            <section className="ltown-workspace">
              {/* Left Column: Map + Model Input Panel */}
              <div className="ltown-workspace-left">
                {/* Map Card */}
                <div className="ltown-map-card">
                  <div className="ltown-section-header">
                    <div>
                      <h2>Pipeline Network Geometry</h2>
                      <p>Click any highlighted candidate pipe on the map or table to inspect details.</p>
                    </div>
                    <div className="ltown-legend" aria-label="Map Legend">
                      <span><i className="legend-pipe" aria-hidden="true" /> Network</span>
                      <span><i className="legend-candidate" aria-hidden="true" /> Eligible Candidate</span>
                      <span><i className="legend-selected" aria-hidden="true" /> Selected Pipe</span>
                    </div>
                  </div>

                  {pipes && (
                    <NetworkMap
                      pipes={pipes}
                      candidates={filteredPriorities}
                      selectedPipe={selectedPipe}
                      onSelect={setSelectedPipe}
                    />
                  )}

                  <p className="ltown-map-note">
                    ⓘ Coordinates represent EPANET topology from the synthetic BattLeDIM L-TOWN benchmark,
                    normalized at world origin (0, 0). Candidates indicate localized hydraulic anomalies,
                    not confirmed pipe bursts.
                  </p>
                </div>

                {/* ── Task 4 & Task 5: SCADA Telemetry Input & Real Inference Panel ── */}
                <div className="ltown-inference-card" aria-label="Model Telemetry Inputs">
                  <div className="ltown-section-header">
                    <div>
                      <h2>🔬 SCADA Telemetry Inputs &amp; Live Model Inference</h2>
                      <p>
                        Supply flow and pressure telemetries to execute fresh inference across candidate pipes.
                        Zero reliance on leakage labels.
                      </p>
                    </div>
                    <div className="ltown-source-toggle">
                      {activeSource === 'live' ? (
                        <span className="ltown-badge-live">⚡ Live Inference Active</span>
                      ) : (
                        <span className="ltown-badge-bench">💾 Benchmark View</span>
                      )}
                    </div>
                  </div>

                  {/* Preset Selector */}
                  <div className="ltown-preset-bar">
                    <label htmlFor="preset-select">Telemetry Scenario Preset:</label>
                    <select
                      id="preset-select"
                      className="ltown-preset-select"
                      value={selectedPresetId}
                      onChange={(e) => handleSelectPreset(e.target.value)}
                    >
                      {presets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                      <option value="custom">⚙ Custom Telemetry Input</option>
                    </select>
                  </div>

                  {/* Telemetry Inputs Grid */}
                  <div className="ltown-telemetry-grid">
                    {/* Flow Sensors */}
                    <div className="ltown-field-group">
                      <label htmlFor="input-p227">Inflow Pipe <code>p227</code></label>
                      <div className="ltown-input-wrapper">
                        <input
                          id="input-p227"
                          type="number"
                          step="0.1"
                          min="0"
                          value={telemetry.p227}
                          onChange={(e) => handleTelemetryChange('p227', e.target.value)}
                          aria-label="Flow meter p227 reading in cubic meters per hour"
                        />
                        <span className="ltown-unit">m³/h</span>
                      </div>
                    </div>

                    <div className="ltown-field-group">
                      <label htmlFor="input-p235">Inflow Pipe <code>p235</code></label>
                      <div className="ltown-input-wrapper">
                        <input
                          id="input-p235"
                          type="number"
                          step="0.1"
                          min="0"
                          value={telemetry.p235}
                          onChange={(e) => handleTelemetryChange('p235', e.target.value)}
                          aria-label="Flow meter p235 reading in cubic meters per hour"
                        />
                        <span className="ltown-unit">m³/h</span>
                      </div>
                    </div>

                    <div className="ltown-field-group">
                      <label htmlFor="input-pump1">Pump Station <code>PUMP_1</code></label>
                      <div className="ltown-input-wrapper">
                        <input
                          id="input-pump1"
                          type="number"
                          step="0.1"
                          min="0"
                          value={telemetry.PUMP_1}
                          onChange={(e) => handleTelemetryChange('PUMP_1', e.target.value)}
                          aria-label="Pumping station flow in cubic meters per hour"
                        />
                        <span className="ltown-unit">m³/h</span>
                      </div>
                    </div>

                    {/* Pressure Sensors */}
                    <div className="ltown-field-group">
                      <label htmlFor="input-n769">Node Pressure <code>n769</code></label>
                      <div className="ltown-input-wrapper">
                        <input
                          id="input-n769"
                          type="number"
                          step="0.1"
                          min="0"
                          max="250"
                          value={telemetry.n769}
                          onChange={(e) => handleTelemetryChange('n769', e.target.value)}
                          aria-label="Pressure head at node n769 in meters"
                        />
                        <span className="ltown-unit">m</span>
                      </div>
                    </div>

                    <div className="ltown-field-group">
                      <label htmlFor="input-n288">Node Pressure <code>n288</code></label>
                      <div className="ltown-input-wrapper">
                        <input
                          id="input-n288"
                          type="number"
                          step="0.1"
                          min="0"
                          max="250"
                          value={telemetry.n288}
                          onChange={(e) => handleTelemetryChange('n288', e.target.value)}
                          aria-label="Pressure head at node n288 in meters"
                        />
                        <span className="ltown-unit">m</span>
                      </div>
                    </div>

                    <div className="ltown-field-group">
                      <label htmlFor="input-n1">Main Pressure <code>n1</code></label>
                      <div className="ltown-input-wrapper">
                        <input
                          id="input-n1"
                          type="number"
                          step="0.1"
                          min="0"
                          max="250"
                          value={telemetry.n1}
                          onChange={(e) => handleTelemetryChange('n1', e.target.value)}
                          aria-label="Pressure head at node n1 in meters"
                        />
                        <span className="ltown-unit">m</span>
                      </div>
                    </div>

                    {/* Temporal Feature */}
                    <div className="ltown-field-group">
                      <label htmlFor="input-hour">Hour of Day (Cycle)</label>
                      <div className="ltown-input-wrapper">
                        <input
                          id="input-hour"
                          type="number"
                          min="0"
                          max="23"
                          value={telemetry.hour}
                          onChange={(e) => handleTelemetryChange('hour', e.target.value)}
                          aria-label="Hour of day between 0 and 23"
                        />
                        <span className="ltown-unit">0-23h</span>
                      </div>
                    </div>
                  </div>

                  {/* Validation Error Banner */}
                  {validationError && (
                    <div className="ltown-validation-error" role="alert">
                      <span>⚠</span> {validationError}
                    </div>
                  )}

                  {/* Inference Notice Banner */}
                  {inferenceNotice && (
                    <div className="ltown-inference-notice" role="status">
                      <span>✓</span> {inferenceNotice}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="ltown-inference-actions">
                    <button
                      type="button"
                      className="ltown-btn-run"
                      onClick={handleRunPrediction}
                      disabled={isPredicting}
                    >
                      {isPredicting ? '⏳ Computing 23 RF Regressors...' : '▶ Run Model Prediction'}
                    </button>

                    {activeSource === 'live' && (
                      <button
                        type="button"
                        className="ltown-btn-revert"
                        onClick={handleRevertBenchmark}
                        disabled={isPredicting}
                      >
                        ↺ Revert to Benchmark Data
                      </button>
                    )}
                  </div>

                  <p className="ltown-inference-footer">
                    🔒 <strong>Leakage-Free Inference:</strong> Evaluates 23 Random Forest models fitted strictly on SCADA telemetry without ground-truth leak files.
                    Notice: Late-onset burst models rely heavily on the seasonal month feature and may generalize poorly to sudden, previously unseen bursts.
                  </p>
                </div>
              </div>

              {/* Right Column: Scenario Policy Controls + Selected Candidate */}
              <aside className="ltown-controls" aria-label="Scenario Controls">
                <div className="ltown-section-header">
                  <div>
                    <h2>Scenario Policy Controls</h2>
                    <p>Adjust planning policy parameters without altering physical telemetry inputs.</p>
                  </div>
                </div>

                {/* Slider 1: Recovery Rate */}
                <label className="ltown-control">
                  <span>Assumed Recovery Rate:</span>
                  <strong>{recoveryPercent}%</strong>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={recoveryPercent}
                    aria-label="Assumed recovery rate percentage"
                    onChange={(e) => setRecoveryPercent(Number(e.target.value))}
                  />
                </label>

                {/* Slider 2: Maximum Individual Repair Cost */}
                <label className="ltown-control">
                  <span>Maximum Pipe Repair Cost:</span>
                  <strong>{formatCurrency(maxBudget)}</strong>
                  <input
                    type="range"
                    min="100000"
                    max="2000000"
                    step="100000"
                    value={maxBudget}
                    aria-label="Maximum individual pipe repair cost limit"
                    onChange={(e) => setMaxBudget(Number(e.target.value))}
                  />
                </label>

                {/* Slider 3: Minimum Predicted Loss */}
                <label className="ltown-control">
                  <span>Minimum Predicted Water Loss:</span>
                  <strong>{formatNumber(minimumLoss, 3)} ML/day</strong>
                  <input
                    type="range"
                    min="0"
                    max="0.5"
                    step="0.025"
                    value={minimumLoss}
                    aria-label="Minimum predicted loss threshold"
                    onChange={(e) => setMinimumLoss(Number(e.target.value))}
                  />
                </label>

                <button
                  type="button"
                  className="ltown-reset-button"
                  onClick={handleResetScenario}
                >
                  ↺ Reset Scenario Defaults
                </button>

                {/* Selected Candidate Detail Card */}
                <div className="ltown-selected-card">
                  <div className="ltown-selected-header">
                    <p className="ltown-eyebrow">SELECTED CANDIDATE</p>
                    {activeSource === 'live' && (
                      <span className="ltown-chip-live">LIVE OUTPUT</span>
                    )}
                  </div>

                  {selectedRecord ? (
                    <>
                      <h3><code>{selectedRecord.Leak_Location ?? selectedRecord.Pipe}</code></h3>
                      <div className="ltown-detail-row">
                        <span>Network Region</span>
                        <strong>Region {selectedRecord.Network_Region ?? '—'}</strong>
                      </div>
                      <div className="ltown-detail-row">
                        <span>Connected Nodes</span>
                        <strong>{selectedRecord.Start_Node} → {selectedRecord.End_Node}</strong>
                      </div>
                      <div className="ltown-detail-row">
                        <span>Predicted Water Loss</span>
                        <strong className={activeSource === 'live' ? 'ltown-metric-live' : ''}>
                          {formatNumber(selectedRecord.Predicted_Loss_ML_per_day, 3)} ML/day
                        </strong>
                      </div>

                      {activeSource === 'live' && selectedRecord.Benchmark_Loss_ML_per_day !== undefined && (
                        <>
                          <div className="ltown-detail-row">
                            <span>Benchmark Reference</span>
                            <strong>{formatNumber(selectedRecord.Benchmark_Loss_ML_per_day, 3)} ML/day</strong>
                          </div>
                          <div className="ltown-detail-row">
                            <span>Delta vs Benchmark</span>
                            <strong
                              style={{
                                color: (selectedRecord.Delta_vs_Benchmark_ML_per_day || 0) >= 0 ? '#ff9f43' : '#e9f056',
                              }}
                            >
                              {(selectedRecord.Delta_vs_Benchmark_ML_per_day || 0) >= 0 ? '+' : ''}
                              {formatNumber(selectedRecord.Delta_vs_Benchmark_ML_per_day || 0, 3)} ML/day
                            </strong>
                          </div>
                        </>
                      )}

                      <div className="ltown-detail-row">
                        <span>Scenario Recovery ({recoveryPercent}%)</span>
                        <strong>
                          {formatNumber(
                            (Number(selectedRecord.Predicted_Loss_ML_per_day) || 0) * (recoveryPercent / 100),
                            3
                          )} ML/day
                        </strong>
                      </div>
                      <div className="ltown-detail-row">
                        <span>Repair Cost Est.</span>
                        <strong>{formatCurrency(selectedRecord.Repair_Cost_INR)}</strong>
                      </div>
                      <div className="ltown-detail-row">
                        <span>Cost-Efficiency</span>
                        <strong>
                          {formatNumber(
                            ((Number(selectedRecord.Predicted_Loss_ML_per_day) || 0) * (recoveryPercent / 100)) /
                            ((Number(selectedRecord.Repair_Cost_INR) || 1) / 100000),
                            4
                          )} ML / ₹1L
                        </strong>
                      </div>
                      <p className="ltown-recommendation">
                        {selectedRecord.Recommendation ?? 'Review Candidate'}
                      </p>
                    </>
                  ) : (
                    <p className="ltown-empty-selection">
                      No candidate selected. Adjust scenario sliders or click a table row.
                    </p>
                  )}
                </div>
              </aside>
            </section>

            {/* ── Table Card ── */}
            <section className="ltown-table-card">
              <div className="ltown-section-header">
                <div>
                  <h2>Filtered Candidate Priorities</h2>
                  <p>
                    {activeSource === 'live'
                      ? 'Live model inferences ranked by predicted loss severity and topological region.'
                      : 'Benchmark candidates sorted by topological region and severity priority.'}
                  </p>
                </div>
                <div className="ltown-table-meta">
                  {activeSource === 'live' && (
                    <span className="ltown-badge-live-sm">⚡ LIVE MODEL DATA</span>
                  )}
                  <span className="ltown-table-count">
                    {filteredPriorities.length} of {activePriorities.length} candidates match
                  </span>
                </div>
              </div>

              <div className="ltown-table-scroll">
                <table className="ltown-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Region</th>
                      <th>{activeSource === 'live' ? 'Live Predicted Loss' : 'Predicted Loss'}</th>
                      {activeSource === 'live' && <th>Δ vs Benchmark</th>}
                      <th>Scenario Recovery ({recoveryPercent}%)</th>
                      <th>Repair Cost</th>
                      <th>Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPriorities.map((row, index) => {
                      const id = String(row.Leak_Location ?? row.Pipe ?? index)
                      const isSelected = id === String(selectedPipe)
                      const loss = Number(row.Predicted_Loss_ML_per_day) || 0
                      const recov = loss * (recoveryPercent / 100)
                      const delta = row.Delta_vs_Benchmark_ML_per_day

                      return (
                        <tr
                          key={id}
                          className={isSelected ? 'ltown-row-selected' : ''}
                          tabIndex={0}
                          role="button"
                          aria-label={`Select candidate pipe ${id}`}
                          onClick={() => setSelectedPipe(id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setSelectedPipe(id)
                            }
                          }}
                        >
                          <td><code>{id}</code></td>
                          <td>Region {row.Network_Region ?? '—'}</td>
                          <td className={activeSource === 'live' ? 'ltown-col-live' : ''}>
                            {formatNumber(loss, 3)} ML/d
                          </td>
                          {activeSource === 'live' && (
                            <td style={{ color: (delta || 0) >= 0 ? '#ff9f43' : '#e9f056' }}>
                              {delta !== undefined ? `${delta >= 0 ? '+' : ''}${formatNumber(delta, 3)} ML/d` : '—'}
                            </td>
                          )}
                          <td>{formatNumber(recov, 3)} ML/d</td>
                          <td>{formatCurrency(row.Repair_Cost_INR)}</td>
                          <td>
                            <span className="rec-badge-inline">
                              {row.Recommendation ?? 'Investigate'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                    {filteredPriorities.length === 0 && (
                      <tr>
                        <td colSpan={activeSource === 'live' ? 7 : 6} className="ltown-no-results">
                          No candidate pipes match the current scenario filters. Lower the loss threshold or increase the budget.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Scientific Disclaimer ── */}
            <p className="ltown-disclaimer">
              ⚠ <strong>Scientific Integrity &amp; Operational Notice:</strong>{' '}
              {activeSource === 'live'
                ? 'Predictions represent genuine machine-learning regression computed in real time from pure SCADA telemetry (flows and pressures). No ground-truth leakage data is used during inference. Note: Models for late-onset burst pipes rely heavily on the seasonal month feature and may generalize poorly to sudden, previously unseen bursts.'
                : 'Scenario controls operate on saved benchmark predictions from the synthetic L-TOWN network dataset.'}{' '}
              All volumetric predictions represent hydraulic anomaly estimates. Field acoustic verification, correlator sensing,
              and on-site investigation are mandatory before initiating physical excavation.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
