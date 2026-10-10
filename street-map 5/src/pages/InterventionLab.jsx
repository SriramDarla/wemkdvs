import { useState, useEffect, useMemo } from 'react'

const PRIORITIES_URL = '/data/final_intervention_priorities.json'

function fmtML(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return `${Number(val).toFixed(3)} ML/day`
}

function fmtCost(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  const num = Number(val)
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)} L`
  return `₹${num.toLocaleString('en-IN')}`
}

function getRecBadgeColor(rec) {
  switch (rec) {
    case 'Critical Water Loss':
      return { bg: '#ff4d4f', text: '#ffffff', border: '#cf1322' }
    case 'High Water Loss':
      return { bg: '#fa8c16', text: '#ffffff', border: '#d46b08' }
    case 'Cost Efficient':
      return { bg: '#52c41a', text: '#ffffff', border: '#389e0d' }
    case 'Investigate':
    default:
      return { bg: '#1890ff', text: '#ffffff', border: '#096dd9' }
  }
}

export default function InterventionLab() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters & sorting
  const [selectedRegion, setSelectedRegion] = useState('ALL')
  const [selectedRec, setSelectedRec] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('rank') // 'rank', 'loss_desc', 'recov_desc', 'cost_asc', 'eff_desc'
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [showMethodology, setShowMethodology] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(PRIORITIES_URL)
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load intervention priorities`)
      const json = await res.json()
      if (!Array.isArray(json) || json.length === 0) {
        throw new Error('No intervention priority data records returned')
      }
      setData(json)
      setSelectedCandidate(json[0] || null)
    } catch (err) {
      console.error('Failed to load intervention priorities:', err)
      setError(err.message || 'Unable to retrieve intervention dataset')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Aggregate metrics from loaded source data
  const metrics = useMemo(() => {
    if (!data.length) return null
    const totalPipes = data.length
    const totalLoss = data.reduce((acc, r) => acc + (Number(r.Predicted_Loss_ML_per_day) || 0), 0)
    const totalRecoverable = data.reduce((acc, r) => acc + (Number(r.Recoverable_ML_per_day) || 0), 0)
    const totalCost = data.reduce((acc, r) => acc + (Number(r.Repair_Cost_INR) || 0), 0)
    const avgEfficiency = totalCost > 0 ? (totalRecoverable / (totalCost / 100000)) : 0
    const criticalCount = data.filter((r) => r.Recommendation === 'Critical Water Loss').length

    return {
      totalPipes,
      totalLoss,
      totalRecoverable,
      totalCost,
      avgEfficiency,
      criticalCount,
    }
  }, [data])

  // Filter and sort items
  const filteredData = useMemo(() => {
    return data
      .filter((item) => {
        if (selectedRegion !== 'ALL' && String(item.Network_Region) !== selectedRegion) {
          return false
        }
        if (selectedRec !== 'ALL' && item.Recommendation !== selectedRec) {
          return false
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim()
          const pipe = (item.Pipe || item.Leak_Location || '').toLowerCase()
          const start = (item.Start_Node || '').toLowerCase()
          const end = (item.End_Node || '').toLowerCase()
          if (!pipe.includes(q) && !start.includes(q) && !end.includes(q)) {
            return false
          }
        }
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'loss_desc') {
          return (Number(b.Predicted_Loss_ML_per_day) || 0) - (Number(a.Predicted_Loss_ML_per_day) || 0)
        }
        if (sortBy === 'recov_desc') {
          return (Number(b.Recoverable_ML_per_day) || 0) - (Number(a.Recoverable_ML_per_day) || 0)
        }
        if (sortBy === 'cost_asc') {
          return (Number(a.Repair_Cost_INR) || 0) - (Number(b.Repair_Cost_INR) || 0)
        }
        if (sortBy === 'eff_desc') {
          return (Number(b.Recoverable_ML_per_1Lakh) || 0) - (Number(a.Recoverable_ML_per_1Lakh) || 0)
        }
        // default: original priority rank in source dataset
        return (data.indexOf(a) - data.indexOf(b))
      })
  }, [data, selectedRegion, selectedRec, searchQuery, sortBy])

  return (
    <div className="page lab-page">
      {/* ── Sticky Top Nav ── */}
      <header className="nav nav-lab">
        <div className="nav-left">
          <a className="brand" href="#/">
            <span className="brand-mark" aria-hidden="true" />
            Leak Detection &amp; Prioritization
          </a>
          <span className="lab-nav-badge">LAB DEMONSTRATION</span>
        </div>

        <nav className="nav-right">
          <a href="#/" className="nav-link">← Overview</a>
          <a href="#/map" className="nav-cta">🗺 Network Map</a>
        </nav>
      </header>

      <main className="lab-main">
        {/* ── Header Section ── */}
        <section className="lab-hero">
          <div className="lab-hero-content">
            <p className="chip">
              <span className="chip-dot" /> SCADA Network Intelligence · L-Town Network
            </p>
            <h1>Network Intervention Lab</h1>
            <p className="lede">
              Analytical ranking of candidate pipe interventions derived from gradient-boosted hydraulic
              anomaly modeling. Direct field investigation crews to locations with the highest estimated volumetric return.
            </p>
          </div>

          <div className="lab-hero-actions">
            <a href="#/map" className="btn btn-primary">
              Explore Network Map <span aria-hidden="true">→</span>
            </a>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowMethodology(!showMethodology)}
              aria-expanded={showMethodology}
            >
              {showMethodology ? 'Hide Methodology' : 'Prioritization Methodology'}
            </button>
          </div>
        </section>

        {/* ── Mandatory Scientific Integrity & Engineering Caveats Banner ── */}
        <section className="lab-caveats-card" aria-label="Scientific Integrity Disclaimers">
          <div className="caveat-header">
            <div className="caveat-icon" aria-hidden="true">⚖️</div>
            <div>
              <h3>Scientific &amp; Operational Caveats</h3>
              <p>Model-derived estimates for engineering decision support. Adhere to verification protocols below.</p>
            </div>
          </div>

          <div className="caveat-grid">
            <div className="caveat-item">
              <strong>Candidate Pipe ≠ Confirmed Leak</strong>
              <p>
                Rankings identify candidate locations with anomalous pressure-flow signatures.
                They do <em>not</em> establish a confirmed leak location without on-site acoustic sounding or correlator validation.
              </p>
            </div>

            <div className="caveat-item">
              <strong>Scenario Assumption (80% Recovery)</strong>
              <p>
                Recoverable water loss reflects a standard engineering scenario assumption (80% capture),
                not a guaranteed physical outcome. Actual recovery depends on soil permeability and pipe condition.
              </p>
            </div>

            <div className="caveat-item">
              <strong>Illustrative Repair Costs</strong>
              <p>
                Cost figures in INR (₹) are standardized illustrative estimates derived from nominal pipe diameter classes.
                They do not represent contracted vendor tenders or local excavation tariffs.
              </p>
            </div>

            <div className="caveat-item">
              <strong>Analytical Regions vs DMAs</strong>
              <p>
                Network regions (Regions 1–4) represent topological clusters used for mathematical modeling
                and are not official utility District Metered Areas (DMAs) unless independently surveyed.
              </p>
            </div>
          </div>
        </section>

        {/* ── Expandable Prioritization Methodology ── */}
        {showMethodology && (
          <section className="methodology-card">
            <h3>How Intervention Priorities Are Determined</h3>
            <div className="methodology-steps">
              <div className="method-step">
                <span className="step-num">01</span>
                <h4>SCADA Anomaly Detection</h4>
                <p>
                  Gradient Boosting regressors ingest historical pressure and flow telemetries from
                  the L-Town benchmark network, comparing observed head-loss curves against nominal hydraulic baselines.
                </p>
              </div>
              <div className="method-step">
                <span className="step-num">02</span>
                <h4>Volumetric Loss Estimation</h4>
                <p>
                  Pipes with sustained negative residual pressure are evaluated for volumetric loss in Megalitres per day (ML/day),
                  factoring upstream source pressure and downstream node demand.
                </p>
              </div>
              <div className="method-step">
                <span className="step-num">03</span>
                <h4>Dual-Metric Prioritization</h4>
                <p>
                  Candidates are prioritized primarily by estimated daily loss severity (<em>Critical</em> &gt; 0.30 ML/day),
                  with secondary ranking by capital efficiency (Recoverable ML per ₹1 Lakh illustrative repair cost).
                </p>
              </div>
              <div className="method-step">
                <span className="step-num">04</span>
                <h4>Field Crew Dispatch Protocol</h4>
                <p>
                  Field technicians deploy acoustic ground microphones along the designated Start-to-End node corridor
                  to pinpoint the exact physical defect before excavation begins.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ── Loading State ── */}
        {loading && (
          <div className="lab-status-card" role="status">
            <div className="loading-spinner" aria-hidden="true" />
            <p>Loading candidate intervention priorities from repository data...</p>
          </div>
        )}

        {/* ── Error State ── */}
        {error && !loading && (
          <div className="lab-status-card error" role="alert">
            <div className="error-icon" aria-hidden="true">⚠️</div>
            <h3>Unable to Load Intervention Data</h3>
            <p>{error}</p>
            <button type="button" className="btn btn-secondary" onClick={fetchData}>
              Retry Loading Data
            </button>
          </div>
        )}

        {/* ── Content When Loaded ── */}
        {!loading && !error && (
          <>
            {/* ── Summary KPI Cards ── */}
            {metrics && (
              <section className="lab-kpi-grid" aria-label="Aggregated Intervention Metrics">
                <div className="kpi-box">
                  <span className="kpi-num">{metrics.totalPipes}</span>
                  <span className="kpi-desc">Candidate Pipes Identified</span>
                  <span className="kpi-sub">Across 4 analytical regions</span>
                </div>

                <div className="kpi-box kpi-highlight-critical">
                  <span className="kpi-num">{metrics.totalLoss.toFixed(2)} ML/d</span>
                  <span className="kpi-desc">Total Estimated Water Loss</span>
                  <span className="kpi-sub">Model-derived volumetric estimate</span>
                </div>

                <div className="kpi-box kpi-highlight-lime">
                  <span className="kpi-num">{metrics.totalRecoverable.toFixed(2)} ML/d</span>
                  <span className="kpi-desc">Scenario Recoverable Water</span>
                  <span className="kpi-sub">Assumes 80% post-repair scenario</span>
                </div>

                <div className="kpi-box">
                  <span className="kpi-num">{fmtCost(metrics.totalCost)}</span>
                  <span className="kpi-desc">Total Illustrative Repair Cost</span>
                  <span className="kpi-sub">Standardized schedule-of-rates estimate</span>
                </div>

                <div className="kpi-box">
                  <span className="kpi-num">{metrics.avgEfficiency.toFixed(3)}</span>
                  <span className="kpi-desc">Avg. Recoverable ML / ₹1 Lakh</span>
                  <span className="kpi-sub">Cost-effectiveness ratio</span>
                </div>
              </section>
            )}

            {/* ── Filter & Search Toolbar ── */}
            <section className="lab-toolbar" aria-label="Candidate Filters and Search">
              <div className="toolbar-group">
                <label htmlFor="search-input" className="toolbar-label">Search Candidate / Node:</label>
                <input
                  id="search-input"
                  type="search"
                  className="toolbar-input"
                  placeholder="e.g. p762, n683, n264..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="toolbar-group">
                <label htmlFor="region-filter" className="toolbar-label">Network Region:</label>
                <select
                  id="region-filter"
                  className="toolbar-select"
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                >
                  <option value="ALL">All Analytical Regions</option>
                  <option value="1">Region 1 (High Priority)</option>
                  <option value="2">Region 2</option>
                  <option value="3">Region 3</option>
                  <option value="4">Region 4</option>
                </select>
              </div>

              <div className="toolbar-group">
                <label htmlFor="rec-filter" className="toolbar-label">Priority Recommendation:</label>
                <select
                  id="rec-filter"
                  className="toolbar-select"
                  value={selectedRec}
                  onChange={(e) => setSelectedRec(e.target.value)}
                >
                  <option value="ALL">All Recommendations</option>
                  <option value="Critical Water Loss">Critical Water Loss</option>
                  <option value="High Water Loss">High Water Loss</option>
                  <option value="Cost Efficient">Cost Efficient</option>
                  <option value="Investigate">Investigate</option>
                </select>
              </div>

              <div className="toolbar-group">
                <label htmlFor="sort-select" className="toolbar-label">Sort Candidates By:</label>
                <select
                  id="sort-select"
                  className="toolbar-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="rank">Intervention Priority Rank</option>
                  <option value="loss_desc">Estimated Loss (High → Low)</option>
                  <option value="recov_desc">Recoverable Loss (High → Low)</option>
                  <option value="eff_desc">Cost Effectiveness (High → Low)</option>
                  <option value="cost_asc">Repair Cost (Low → High)</option>
                </select>
              </div>

              {(searchQuery || selectedRegion !== 'ALL' || selectedRec !== 'ALL' || sortBy !== 'rank') && (
                <button
                  type="button"
                  className="toolbar-reset-btn"
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedRegion('ALL')
                    setSelectedRec('ALL')
                    setSortBy('rank')
                  }}
                >
                  Reset Filters
                </button>
              )}
            </section>

            {/* ── Empty State ── */}
            {filteredData.length === 0 && (
              <div className="lab-status-card" role="status">
                <div className="empty-icon" aria-hidden="true">🔍</div>
                <h3>No Candidate Pipes Match Criteria</h3>
                <p>No candidates match the selected region, recommendation, or search query.</p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedRegion('ALL')
                    setSelectedRec('ALL')
                    setSortBy('rank')
                  }}
                >
                  Clear Filters
                </button>
              </div>
            )}

            {/* ── Main Work Area: Table + Detail Inspector ── */}
            {filteredData.length > 0 && (
              <div className="lab-layout-split">
                {/* ── Rankings Table ── */}
                <div className="lab-table-container">
                  <div className="table-header-info">
                    <h2>Candidate Pipe Rankings</h2>
                    <span className="table-counter">
                      Showing {filteredData.length} of {data.length} candidate pipes
                    </span>
                  </div>

                  <div className="priority-table-wrap">
                    <table className="priority-table lab-table">
                      <thead>
                        <tr>
                          <th scope="col">Rank</th>
                          <th scope="col">Candidate Pipe</th>
                          <th scope="col">Network Region</th>
                          <th scope="col">Est. Loss (ML/d)</th>
                          <th scope="col">Recoverable (ML/d)*</th>
                          <th scope="col">Repair Cost*</th>
                          <th scope="col">Efficiency (ML/₹1L)</th>
                          <th scope="col">Recommendation</th>
                          <th scope="col">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredData.map((item) => {
                          const originalRank = data.indexOf(item) + 1
                          const pipeId = item.Pipe || item.Leak_Location
                          const isSelected = selectedCandidate && (selectedCandidate.Pipe || selectedCandidate.Leak_Location) === pipeId
                          const badge = getRecBadgeColor(item.Recommendation)
                          const lossVal = Number(item.Predicted_Loss_ML_per_day) || 0
                          const lossPercent = Math.min(100, Math.round((lossVal / 0.4) * 100))

                          return (
                            <tr
                              key={pipeId}
                              className={`priority-row${isSelected ? ' selected' : ''}`}
                              onClick={() => setSelectedCandidate(item)}
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  setSelectedCandidate(item)
                                }
                              }}
                            >
                              <td>
                                <span className={`rank-pill rank-${originalRank <= 3 ? 'top' : 'normal'}`}>
                                  #{originalRank}
                                </span>
                              </td>
                              <td>
                                <div className="pipe-cell">
                                  <code>{pipeId}</code>
                                  <span className="node-sub">
                                    {item.Start_Node} → {item.End_Node}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <span className="region-tag">Region {item.Network_Region}</span>
                                <span className="sub-rank">Rank #{item.Pipe_Priority_Within_Region}</span>
                              </td>
                              <td>
                                <div className="loss-cell">
                                  <span className="loss-val">{lossVal.toFixed(3)}</span>
                                  <div className="loss-bar-track" aria-hidden="true">
                                    <div className="loss-bar-fill" style={{ width: `${lossPercent}%` }} />
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="recov-val">
                                  {Number(item.Recoverable_ML_per_day).toFixed(3)}
                                </span>
                              </td>
                              <td>
                                <span className="cost-val">
                                  {fmtCost(item.Repair_Cost_INR)}
                                </span>
                              </td>
                              <td>
                                <span className="eff-val">
                                  {Number(item.Recoverable_ML_per_1Lakh).toFixed(4)}
                                </span>
                              </td>
                              <td>
                                <span
                                  className="rec-badge"
                                  style={{
                                    backgroundColor: badge.bg,
                                    color: badge.text,
                                    borderColor: badge.border,
                                  }}
                                >
                                  {item.Recommendation}
                                </span>
                              </td>
                              <td>
                                <a
                                  href="#/map"
                                  className="table-action-link"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                  }}
                                  title={`Inspect ${pipeId} on Network Map`}
                                >
                                  Map ↗
                                </a>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <p className="table-caption-note">
                    * Values marked with an asterisk are scenario assumptions (80% recovery) or illustrative cost estimates.
                    Field investigation with acoustic sensors is required prior to excavation.
                  </p>
                </div>

                {/* ── Candidate Pipe Inspector Dossier ── */}
                {selectedCandidate && (
                  <aside className="candidate-dossier" aria-label="Selected Candidate Pipe Dossier">
                    <div className="dossier-header">
                      <div>
                        <span className="dossier-eyebrow">CANDIDATE INTERVENTION DOSSIER</span>
                        <h3 className="dossier-title">
                          Pipe <code>{selectedCandidate.Pipe || selectedCandidate.Leak_Location}</code>
                        </h3>
                      </div>
                      <span
                        className="rec-badge"
                        style={{
                          backgroundColor: getRecBadgeColor(selectedCandidate.Recommendation).bg,
                          color: getRecBadgeColor(selectedCandidate.Recommendation).text,
                        }}
                      >
                        {selectedCandidate.Recommendation}
                      </span>
                    </div>

                    <div className="dossier-body">
                      {/* Ranking Callout */}
                      <div className="dossier-ranks">
                        <div className="rank-stat">
                          <span className="rank-stat-label">Global Network Rank</span>
                          <span className="rank-stat-val">#{data.indexOf(selectedCandidate) + 1}</span>
                        </div>
                        <div className="rank-stat">
                          <span className="rank-stat-label">Region {selectedCandidate.Network_Region} Rank</span>
                          <span className="rank-stat-val">#{selectedCandidate.Pipe_Priority_Within_Region}</span>
                        </div>
                        <div className="rank-stat">
                          <span className="rank-stat-label">Regional Priority</span>
                          <span className="rank-stat-val">Tier {selectedCandidate.Region_Priority}</span>
                        </div>
                      </div>

                      {/* Topology Details */}
                      <div className="dossier-section">
                        <h4>Topology &amp; Connectivity</h4>
                        <div className="topology-box">
                          <div className="topo-node">
                            <span className="topo-label">Start Node</span>
                            <code>{selectedCandidate.Start_Node}</code>
                          </div>
                          <div className="topo-arrow" aria-hidden="true">━━▶</div>
                          <div className="topo-node">
                            <span className="topo-label">End Node</span>
                            <code>{selectedCandidate.End_Node}</code>
                          </div>
                        </div>
                      </div>

                      {/* Hydraulic & Volumetric Metrics */}
                      <div className="dossier-section">
                        <h4>Volumetric &amp; Financial Analysis</h4>
                        <div className="metric-row">
                          <span className="metric-name">Estimated Daily Water Loss:</span>
                          <strong className="metric-value">{fmtML(selectedCandidate.Predicted_Loss_ML_per_day)}</strong>
                        </div>
                        <div className="metric-row">
                          <span className="metric-name">Scenario Recoverable Water (80%):</span>
                          <strong className="metric-value lime-text">{fmtML(selectedCandidate.Recoverable_ML_per_day)}</strong>
                        </div>
                        <div className="metric-row">
                          <span className="metric-name">Illustrative Repair Budget:</span>
                          <strong className="metric-value">{fmtCost(selectedCandidate.Repair_Cost_INR)}</strong>
                        </div>
                        <div className="metric-row">
                          <span className="metric-name">Cost-Effectiveness Index:</span>
                          <strong className="metric-value">{Number(selectedCandidate.Recoverable_ML_per_1Lakh).toFixed(4)} ML / ₹1L</strong>
                        </div>
                      </div>

                      {/* Recommended Operational Protocol */}
                      <div className="dossier-section dossier-protocol">
                        <h4>Recommended Field Protocol</h4>
                        <ol className="protocol-list">
                          <li>Deploy correlator sensors between <code>{selectedCandidate.Start_Node}</code> and <code>{selectedCandidate.End_Node}</code>.</li>
                          <li>Conduct acoustic sounding to confirm physical defect location.</li>
                          <li>Isolate boundary isolation valves prior to mechanical civil excavation.</li>
                        </ol>
                      </div>

                      <div className="dossier-actions">
                        <a href="#/map" className="btn btn-primary btn-block">
                          Open in Network Map <span aria-hidden="true">→</span>
                        </a>
                      </div>
                    </div>
                  </aside>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="lab-footer">
        <div>
          <strong>WeMakeDevs Water Network Intelligence</strong> · Research Demonstration Platform
        </div>
        <div>
          Analytical regions are not official DMAs · Model estimates require field acoustic confirmation
        </div>
      </footer>
    </div>
  )
}
