import React, { useEffect } from 'react'

export default function HeadIncludes() {
  useEffect(() => {
    // Inject Leaflet CSS (avoid duplicates)
    const existingLink = document.querySelector('link[data-leaflet]')
    let link = existingLink
    if (!link) {
      link = document.createElement('link')
      link.setAttribute('data-leaflet', 'true')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    // Inject Leaflet JS and notify when ready
    const existingScript = document.querySelector('script[data-leaflet]')
    let script = existingScript
    if (!script) {
      script = document.createElement('script')
      script.setAttribute('data-leaflet', 'true')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.async = true
      script.onload = () => {
        // Signal that Leaflet is available
        window.dispatchEvent(new Event('leaflet:loaded'))
      }
      document.body.appendChild(script)
    } else {
      // If it already exists and L is present, still dispatch to unblock listeners
      if (window.L) {
        setTimeout(() => window.dispatchEvent(new Event('leaflet:loaded')), 0)
      }
    }

    return () => {
      // Do not remove tags on unmount to prevent re-initialization issues on route changes
    }
  }, [])

  return null
}
