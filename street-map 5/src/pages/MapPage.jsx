import { useState } from 'react'
import MapView from '../components/MapView.jsx'

export default function MapPage() {
  const [activeTab, setActiveTab] = useState('map')

  return (
    <div className="page page-map">
      <header className="nav">
        <a className="back" href="#/">← Back</a>

        {/* ── Tab toggle lives here, outside the map canvas ── */}
        <div className="nav-tabs">
          <button
            className={`nav-tab${activeTab === 'map' ? ' active' : ''}`}
            onClick={() => setActiveTab('map')}
          >🗺 Network Map</button>
          <button
            className={`nav-tab${activeTab === 'pipeline' ? ' active' : ''}`}
            onClick={() => setActiveTab('pipeline')}
          >🤖 ML Pipeline</button>
        </div>

        <span className="nav-title">Skyline</span>
      </header>

      <main className="map-main">
        <MapView activeTab={activeTab} />
      </main>
    </div>
  )
}
