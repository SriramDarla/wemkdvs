import { useEffect, useState } from 'react'
import Landing from './pages/Landing.jsx'
import MapPage from './pages/MapPage.jsx'
import InterventionLab from './pages/InterventionLab.jsx'

// Tiny hash router: "#/" is the landing page, "#/map" is the map page, "#/intervention" is the intervention lab.
function useRoute() {
  const read = () => {
    const hash = window.location.hash
    if (hash.startsWith('#/map')) return 'map'
    if (hash.startsWith('#/intervention')) return 'intervention'
    return 'home'
  }
  const [route, setRoute] = useState(read)

  useEffect(() => {
    const onChange = () => {
      setRoute(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}

export default function App() {
  const route = useRoute()
  if (route === 'map') return <MapPage />
  if (route === 'intervention') return <InterventionLab />
  return <Landing />
}
