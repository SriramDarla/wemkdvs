import { useEffect, useState } from 'react'
import Landing from './pages/Landing.jsx'
import MapPage from './pages/MapPage.jsx'

// Tiny hash router: "#/" is the landing page, "#/map" is the map page.
function useRoute() {
  const read = () => (window.location.hash.startsWith('#/map') ? 'map' : 'home')
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
  return route === 'map' ? <MapPage /> : <Landing />
}
