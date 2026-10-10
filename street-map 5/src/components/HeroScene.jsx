// A small isometric "city block" illustration drawn in SVG. Colours come from
// the .g-* / .b-* / .pipe-* / .leak-* classes in styles.css so the palette
// lives in one place. Meant to sit on the lime hero panel.

const OX = 260 // origin x on the canvas
const OY = 70 // origin y
const UX = 42 // horizontal size of one grid step
const UY = 21 // vertical size of one grid step

const project = (x, y, z = 0) => [OX + (x - y) * UX, OY + (x + y) * UY - z]
const pts = (list) => list.map(([x, y, z]) => project(x, y, z).join(',')).join(' ')

// Building heights (px) on a 5 x 5 grid. 0 = empty lot.
const HEIGHTS = [
  [34, 52, 26, 70, 30],
  [58, 0, 84, 40, 22],
  [28, 96, 36, 0, 62],
  [74, 32, 50, 108, 28],
  [40, 66, 24, 44, 80],
]

const PAD = 0.16 // gap between buildings = street width

export default function HeroScene() {
  const buildings = []
  HEIGHTS.forEach((row, j) =>
    row.forEach((h, i) => h && buildings.push({ i, j, h }))
  )
  // Painter's algorithm: draw far buildings first.
  buildings.sort((a, b) => a.i + a.j - (b.i + b.j))

  // Pipeline follows the streets (grid lines), with a leak at the corner.
  const pipe = [[0, 3, 0], [3, 3, 0], [3, 5, 0]]
  const [leakX, leakY] = project(3, 3, 0)

  return (
    <svg
      className="scene"
      viewBox="0 20 520 300"
      role="img"
      aria-label="Isometric illustration of city blocks with a pipeline and a highlighted leak"
    >
      <g className="scene-float">
        {/* ground */}
        <polygon
          className="g-ground"
          points={pts([[-0.4, -0.4, 0], [5.4, -0.4, 0], [5.4, 5.4, 0], [-0.4, 5.4, 0]])}
        />

        {/* buildings */}
        {buildings.map(({ i, j, h }) => {
          const x0 = i + PAD
          const x1 = i + 1 - PAD
          const y0 = j + PAD
          const y1 = j + 1 - PAD
          return (
            <g key={`${i}-${j}`}>
              <polygon className="b-left" points={pts([[x0, y1, 0], [x1, y1, 0], [x1, y1, h], [x0, y1, h]])} />
              <polygon className="b-right" points={pts([[x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h]])} />
              <polygon
                className={h > 70 ? 'b-top b-top-tall' : 'b-top'}
                points={pts([[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]])}
              />
            </g>
          )
        })}

        {/* pipeline, drawn on top like an x-ray of the pipes under the streets */}
        <polyline className="pipe-under" points={pts(pipe)} />
        <polyline className="pipe-flow" points={pts(pipe)} />

        {/* leak marker */}
        <g transform={`translate(${leakX} ${leakY})`}>
          <circle className="leak-ring" r="10" />
          <circle className="leak-ring leak-ring-2" r="10" />
          <circle className="leak-dot" r="8" />
          <circle className="leak-core" r="3.5" />
        </g>
      </g>
    </svg>
  )
}
