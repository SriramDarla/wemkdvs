import HeroScene from '../components/HeroScene.jsx'

const FEATURES = [
  {
    tone: 'lime',
    title: 'Tilt & rotate',
    text: 'Look at any street from straight above or at eye level, and spin all the way around it.',
    big: true,
  },
  {
    tone: 'tint',
    title: '3D buildings',
    text: 'Buildings rise from the map at their real heights.',
  },
  {
    tone: 'ink',
    title: 'Search anywhere',
    text: 'Type a place or an address and fly straight there.',
  },
  {
    tone: 'lime',
    title: 'Bring your own data',
    text: 'Built to overlay your own layers, such as pipeline networks and detected leaks.',
    big: true,
  },
]

export default function Landing() {
  return (
    <div className="page landing">
      <header className="nav nav-landing">
        <a className="brand" href="#/">
          <span className="brand-mark" aria-hidden="true" />
          Skyline
        </a>
        <nav>
          <a href="#features" className="nav-link">Features</a>
          <a href="#/map" className="nav-cta">Open map</a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="chip"><span className="chip-dot" /> Interactive 3D maps</p>
            <h1>
              See the city from <em>every angle.</em>
            </h1>
            <p className="lede">
              Tilt, spin and fly through street-level maps with real 3D buildings,
              right in your browser. No install, no sign-up.
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="#/map">Open the map <span aria-hidden="true">→</span></a>
              <a className="btn btn-ghost" href="#features">See what it does</a>
            </div>
            <ul className="stats">
              <li><strong>3D</strong><span>buildings</span></li>
              <li><strong>0–85°</strong><span>tilt</span></li>
              <li><strong>360°</strong><span>rotation</span></li>
            </ul>
          </div>

          <div className="hero-visual">
            <HeroScene />
          </div>
        </section>

        <section id="features" className="features">
          <div className="section-head">
            <p className="chip chip-lime">Features</p>
            <h2>Everything you need to explore a city in 3D.</h2>
          </div>
          <div className="bento">
            {FEATURES.map((f) => (
              <article key={f.title} className={`card card-${f.tone}${f.big ? ' card-big' : ''}`}>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="cta">
          <h2>Ready to take a look around?</h2>
          <a className="btn btn-lime" href="#/map">Open the map <span aria-hidden="true">→</span></a>
        </section>
      </main>

      <footer className="footer">
        <span>© {new Date().getFullYear()} Skyline</span>
        <span>Map data © OpenStreetMap contributors · © CARTO</span>
      </footer>
    </div>
  )
}
