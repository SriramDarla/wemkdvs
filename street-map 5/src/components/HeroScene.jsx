// HeroScene.jsx
// Subterranean hydraulic demonstration of a municipal water distribution network.
// Visualises transmission mains, distribution branches, SCADA telemetry stations,
// and candidate pipe p762 inspection telemetry from the L-TOWN benchmark model.

const OX = 270
const OY = 60
const UX = 42
const UY = 21

const project = (x, y, z = 0) => [
  Math.round(OX + (x - y) * UX),
  Math.round(OY + (x + y) * UY - z),
]

const pts = (list) =>
  list.map(([x, y, z = 0]) => project(x, y, z).join(',')).join(' ')

// Context buildings situated between pipeline easements
const BUILDINGS = [
  // Far tier
  { x: 0.3, y: 0.3, w: 1.2, d: 1.2, h: 40 },
  { x: 2.3, y: 0.3, w: 1.3, d: 1.2, h: 56 },
  { x: 4.2, y: 0.3, w: 1.0, d: 1.2, h: 36 },

  // Mid tier
  { x: 0.3, y: 2.3, w: 1.2, d: 1.2, h: 32 },
  { x: 2.3, y: 2.3, w: 1.3, d: 1.2, h: 48 },
  { x: 4.2, y: 2.3, w: 1.0, d: 1.2, h: 60 },

  // Near tier
  { x: 0.3, y: 4.2, w: 1.2, d: 1.0, h: 26 },
  { x: 4.2, y: 4.2, w: 1.0, d: 1.0, h: 38 },
]

export default function HeroScene() {
  // Sort buildings back-to-front for painter's algorithm
  const buildings = [...BUILDINGS].sort(
    (a, b) => a.x + a.w / 2 + (a.y + a.d / 2) - (b.x + b.w / 2 + (b.y + b.d / 2))
  )

  // Pipeline network corridors running along street avenues (x=1.9, 3.9; y=1.9, 3.9)
  const pipeInlet = [[0, 1.9], [1.9, 1.9]]
  const pipeNorthA = [[1.9, 0], [1.9, 1.9]]
  const pipeEastCross = [[1.9, 1.9], [3.9, 1.9]]
  const pipeNorthB = [[3.9, 0], [3.9, 1.9]]
  const pipeMidStem = [[1.9, 1.9], [1.9, 3.9]]
  const pipeEastStem = [[3.9, 1.9], [3.9, 3.9]]
  const pipeSouthStem = [[1.9, 3.9], [1.9, 5.2]]
  const pipeEastOutlet = [[3.9, 3.9], [5.2, 3.9]]

  // Candidate pipe p762 (Connecting node n683 to node n264)
  const candidatePipe = [[1.9, 3.9], [3.9, 3.9]]

  // Key node points
  const [inletX, inletY] = project(0.4, 1.9)
  const [junc1X, junc1Y] = project(1.9, 1.9)
  const [junc2X, junc2Y] = project(3.9, 1.9)
  const [n683X, n683Y] = project(1.9, 3.9)
  const [n264X, n264Y] = project(3.9, 3.9)

  // Leak midpoint on candidate pipe p762: (2.9, 3.9)
  const [leakX, leakY] = project(2.9, 3.9)

  return (
    <div className="hero-console">
      {/* Console Demonstration Header Bar */}
      <div className="hero-console-head">
        <div className="console-tag">
          <span className="console-indicator" aria-hidden="true" />
          <span>L-TOWN NETWORK · MODEL DEMONSTRATION</span>
        </div>
        <div className="console-meta">
          <span>HYDRAULIC NETWORK VIEW</span>
          <span className="console-divider">/</span>
          <span>CANDIDATE PIPE ANALYSIS</span>
        </div>
      </div>

      {/* SVG Isometric Hydraulic Demonstration View */}
      <svg
        className="scene"
        viewBox="0 0 540 315"
        role="img"
        aria-label="Isometric illustration of subterranean water distribution pipelines with modeled flow and candidate pipe p762 analysis"
      >
        <g className="scene-float">
          {/* Subsurface ground plane */}
          <polygon
            className="g-ground"
            points={pts([
              [-0.3, -0.3],
              [5.4, -0.3],
              [5.4, 5.4],
              [-0.3, 5.4],
            ])}
          />

          {/* Grid lines indicating pipeline easements */}
          <line
            className="g-grid-line"
            x1={project(-0.2, 1.9)[0]}
            y1={project(-0.2, 1.9)[1]}
            x2={project(5.3, 1.9)[0]}
            y2={project(5.3, 1.9)[1]}
          />
          <line
            className="g-grid-line"
            x1={project(-0.2, 3.9)[0]}
            y1={project(-0.2, 3.9)[1]}
            x2={project(5.3, 3.9)[0]}
            y2={project(5.3, 3.9)[1]}
          />
          <line
            className="g-grid-line"
            x1={project(1.9, -0.2)[0]}
            y1={project(1.9, -0.2)[1]}
            x2={project(1.9, 5.3)[0]}
            y2={project(1.9, 5.3)[1]}
          />
          <line
            className="g-grid-line"
            x1={project(3.9, -0.2)[0]}
            y1={project(3.9, -0.2)[1]}
            x2={project(3.9, 5.3)[0]}
            y2={project(3.9, 5.3)[1]}
          />

          {/* District context building prisms (sorted back-to-front) */}
          {buildings.map(({ x, y, w, d, h }, idx) => {
            const x0 = x
            const x1 = x + w
            const y0 = y
            const y1 = y + d
            return (
              <g key={`bldg-${idx}`}>
                {/* Left face */}
                <polygon
                  className="b-left"
                  points={pts([
                    [x0, y1, 0],
                    [x1, y1, 0],
                    [x1, y1, h],
                    [x0, y1, h],
                  ])}
                />
                {/* Right face */}
                <polygon
                  className="b-right"
                  points={pts([
                    [x1, y0, 0],
                    [x1, y1, 0],
                    [x1, y1, h],
                    [x1, y0, h],
                  ])}
                />
                {/* Roof face */}
                <polygon
                  className={h > 50 ? 'b-top b-top-tall' : 'b-top'}
                  points={pts([
                    [x0, y0, h],
                    [x1, y0, h],
                    [x1, y1, h],
                    [x0, y1, h],
                  ])}
                />
              </g>
            )
          })}

          {/* Subsurface pipeline conduit layer (dark outer casings) */}
          <polyline className="pipe-under" points={pts(pipeInlet)} />
          <polyline className="pipe-under" points={pts(pipeNorthA)} />
          <polyline className="pipe-under" points={pts(pipeEastCross)} />
          <polyline className="pipe-under" points={pts(pipeNorthB)} />
          <polyline className="pipe-under" points={pts(pipeMidStem)} />
          <polyline className="pipe-under" points={pts(pipeEastStem)} />
          <polyline className="pipe-under" points={pts(pipeSouthStem)} />
          <polyline className="pipe-under" points={pts(pipeEastOutlet)} />

          {/* Modeled water flow indicators (inner animated core) */}
          <polyline className="pipe-flow" points={pts(pipeInlet)} />
          <polyline className="pipe-flow" points={pts(pipeNorthA)} />
          <polyline className="pipe-flow" points={pts(pipeEastCross)} />
          <polyline className="pipe-flow" points={pts(pipeNorthB)} />
          <polyline className="pipe-flow" points={pts(pipeMidStem)} />
          <polyline className="pipe-flow" points={pts(pipeEastStem)} />
          <polyline className="pipe-flow" points={pts(pipeSouthStem)} />
          <polyline className="pipe-flow" points={pts(pipeEastOutlet)} />

          {/* Candidate pipe p762 (Connecting n683 to n264) */}
          <polyline className="pipe-candidate-under" points={pts(candidatePipe)} />
          <polyline className="pipe-candidate-flow" points={pts(candidatePipe)} />

          {/* Network junction nodes */}
          <circle className="node-marker" cx={junc1X} cy={junc1Y} r="4.5" />
          <circle className="node-marker" cx={junc2X} cy={junc2Y} r="4.5" />
          <circle className="node-marker" cx={n683X} cy={n683Y} r="5" />
          <circle className="node-marker" cx={n264X} cy={n264Y} r="5" />

          {/* Node tags */}
          <text x={n683X - 16} y={n683Y + 14} className="node-label">n683</text>
          <text x={n264X + 8} y={n264Y + 14} className="node-label">n264</text>

          {/* SCADA Telemetry sensor station indicators */}
          {/* Inlet Flow Meter: FM-01 */}
          <g transform={`translate(${inletX}, ${inletY})`}>
            <circle className="sensor-badge" r="9" />
            <text className="sensor-text">FM</text>
          </g>

          {/* Pressure Transducer: PT-04 */}
          <g transform={`translate(${junc2X}, ${junc2Y})`}>
            <circle className="sensor-badge" r="9" />
            <text className="sensor-text">PT</text>
          </g>

          {/* Candidate leak inspection point at (2.9, 3.9) */}
          <g transform={`translate(${leakX}, ${leakY})`}>
            <circle className="leak-ring" r="10" />
            <circle className="leak-ring leak-ring-2" r="10" />
            <circle className="leak-dot" r="7.5" />
            <circle className="leak-core" r="3" />
          </g>

          {/* Leader line connecting candidate pipe to analysis card */}
          <polyline
            className="leader-line"
            points={`${leakX},${leakY} ${leakX + 42},${leakY + 16} 298,${leakY + 16}`}
          />
          <circle cx={leakX} cy={leakY} r="2.5" className="leader-dot" />

          {/* Candidate Pipe Inspection Analysis Card */}
          <g transform="translate(298, 172)">
            <rect className="callout-box" width="226" height="86" rx="10" />

            {/* Classification Badge: TOP-RANKED CANDIDATE */}
            <rect x="12" y="10" width="132" height="17" rx="4" className="callout-badge-rect" />
            <text x="78" y="21.5" className="callout-badge-text" textAnchor="middle">
              TOP-RANKED CANDIDATE
            </text>

            <text x="12" y="42" className="callout-tag">
              CANDIDATE PIPE p762
            </text>
            <text x="12" y="58" className="callout-sub">
              Region 1 · Start: n683 · End: n264
            </text>
            <text x="12" y="74" className="callout-metric">
              Est. Loss: 0.37 ML/d · Priority #1
            </text>
          </g>
        </g>
      </svg>

      {/* Console Readout Footer */}
      <div className="hero-console-foot">
        <div className="console-stat">
          <span className="stat-label">Analyzed Telemetry</span>
          <span className="stat-val">Flow + Pressure</span>
        </div>
        <div className="console-stat">
          <span className="stat-label">Top-Ranked Candidate</span>
          <span className="stat-val">p762 · Region 1 (0.37 ML/d)</span>
        </div>
        <div className="console-stat">
          <span className="stat-label">Model Strategy</span>
          <span className="stat-val">Hybrid RF / Baseline</span>
        </div>
      </div>
    </div>
  )
}
