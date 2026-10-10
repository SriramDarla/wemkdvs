import HeroScene from '../components/HeroScene.jsx'

const FEATURES = [
  {
    tone: 'lime',
    title: 'Network topology & 3D view',
    text: 'Render municipal distribution pipelines across urban terrain with 3D buildings, dynamic pitch, and full orbital rotation.',
    big: true,
  },
  {
    tone: 'tint',
    title: 'Candidate pipe analysis',
    text: 'Evaluate model-predicted hydraulic anomalies and isolate candidate pipes with significant estimated head loss.',
  },
  {
    tone: 'ink',
    title: 'Search & geographic exploration',
    text: 'Locate municipal assets, search any street or landmark, and navigate straight to key distribution zones.',
  },
  {
    tone: 'lime',
    title: 'Intervention prioritization',
    text: 'Rank candidate pipe interventions by estimated water loss, evaluate 80% recovery scenarios, and optimize repair budget efficiency.',
    big: true,
  },
]

export default function Landing() {
  return (
    <div className="page landing">
      <header className="nav nav-landing">
        <a className="brand" href="#/">
          <span className="brand-mark" aria-hidden="true" />
          Leak Detection &amp; Prioritization
        </a>
        <nav>
          <a href="#features" className="nav-link">Features</a>
          <a href="#/ltown" className="nav-link">L-Town Benchmark</a>
          <a href="#/intervention" className="nav-link">Intervention Lab</a>
          <a href="#/map" className="nav-cta">Explore Map</a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="chip"><span className="chip-dot" /> SCADA Network Intelligence</p>
            <h1>
              Pinpoint candidate leaks. <em>Prioritize field intervention.</em>
            </h1>
            <p className="lede">
              Analyze SCADA flow and pressure telemetries across municipal distribution
              topologies to estimate localized water loss, evaluate recovery impact,
              and direct engineering teams where it matters most.
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="#/map">Explore Network Map <span aria-hidden="true">→</span></a>
              <a className="btn btn-secondary" href="#/intervention">Network Intervention Lab <span aria-hidden="true">→</span></a>
              <a className="btn btn-ghost" href="#features">Decision Framework</a>
            </div>
            <ul className="stats">
              <li><strong>905</strong><span>network pipes</span></li>
              <li><strong>4</strong><span>analytical regions</span></li>
              <li><strong>80%</strong><span>recovery scenario</span></li>
            </ul>
          </div>

          <div className="hero-visual">
            <HeroScene />
          </div>
        </section>

        <section id="features" className="features">
          <div className="section-head">
            <p className="chip chip-lime">Features</p>
            <h2>Explore the network. Prioritize the response.</h2>
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
          <h2>Ready to explore the network?</h2>
          <a className="btn btn-lime" href="#/map">Open Network Map <span aria-hidden="true">→</span></a>
        </section>
      </main>

      <footer className="footer">
        <span>© {new Date().getFullYear()} Leak Detection &amp; Intervention Prioritization</span>
        <span>Map data © OpenStreetMap contributors · © CARTO</span>
      </footer>
    </div>
  )
}
