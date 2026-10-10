import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const PRIORITIES_URL = '/data/final_intervention_priorities.json'
const PIPE_DATA_URL = '/data/pipes.geojson'

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
      // Base pipe network
      map.addSource('ltown-pipes', {
        type: 'geojson',
        data: pipes,
      })

      // Dynamic scenario candidate pipes
      map.addSource('ltown-candidates', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // Currently selected pipe highlight
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

      // Fit network bounds centered on (0, 0)
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
  const [priorities, setPriorities] = useState([])
  const [pipes, setPipes] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Scenario control state
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

        const [priorityResponse, pipeResponse] = await Promise.all([
          fetch(PRIORITIES_URL),
          fetch(PIPE_DATA_URL),
        ])

        if (!priorityResponse.ok || !pipeResponse.ok) {
          throw new Error('Could not load the L-TOWN benchmark data files.')
        }

        const priorityData = await priorityResponse.json()
        const pipeData = await pipeResponse.json()

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

        setPriorities(sortedRows)
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

  // Filter priorities strictly according to scenario controls
  const filteredPriorities = useMemo(() => {
    return priorities.filter((row) => {
      const rawLoss = row.Predicted_Loss_ML_per_day
      const rawCost = row.Repair_Cost_INR
      if (rawLoss === null || rawLoss === undefined || isNaN(Number(rawLoss))) return false
      if (rawCost === null || rawCost === undefined || isNaN(Number(rawCost))) return false

      const loss = Number(rawLoss)
      const cost = Number(rawCost)
      return loss >= minimumLoss && cost <= maxBudget
    })
  }, [priorities, minimumLoss, maxBudget])

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

  const handleResetScenario = () => {
    setRecoveryPercent(80)
    setMaxBudget(1000000)
    setMinimumLoss(0.1)
    if (priorities.length > 0) {
      setSelectedPipe(String(priorities[0].Leak_Location ?? priorities[0].Pipe ?? ''))
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
              Explore hydraulic simulation data from the L-TOWN benchmark network and
              evaluate intervention priorities using dynamic recovery, budget, and loss thresholds.
            </p>
          </div>
          <div className="ltown-benchmark-label">BENCHMARK DATASET</div>
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

            {/* ── Workspace: Map + Controls ── */}
            <section className="ltown-workspace">
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

              {/* Controls Card */}
              <aside className="ltown-controls" aria-label="Scenario Controls">
                <div className="ltown-section-header">
                  <div>
                    <h2>Scenario Controls</h2>
                    <p>Adjust parameters to test recovery and budget sensitivity.</p>
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
                  <p className="ltown-eyebrow">SELECTED CANDIDATE</p>
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
                        <span>Predicted Loss</span>
                        <strong>{formatNumber(selectedRecord.Predicted_Loss_ML_per_day, 3)} ML/day</strong>
                      </div>
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
                  <p>Sorted by topological region and severity priority.</p>
                </div>
                <span className="ltown-table-count">
                  {filteredPriorities.length} of {priorities.length} candidates match
                </span>
              </div>

              <div className="ltown-table-scroll">
                <table className="ltown-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Region</th>
                      <th>Predicted Loss</th>
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
                          <td>{formatNumber(loss, 3)} ML/d</td>
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
                        <td colSpan="6" className="ltown-no-results">
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
              ⚠ <strong>Scenario Demonstration Notice:</strong> This interface operates on saved benchmark predictions
              from the synthetic L-TOWN network dataset. Scenario controls dynamically compute recovery projections;
              they do not run live machine-learning inference against utility equipment. Water recovery assumptions
              (default 80%) require on-site field validation, soil assessment, and pipe rehabilitation verification
              before capital expenditure.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
