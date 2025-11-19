import React, { useEffect, useRef, useState } from 'react'

export default function MapSection() {
  const mapRef = useRef(null)
  const [activeLayer, setActiveLayer] = useState('heat')
  const [ready, setReady] = useState(false)
  const mapInstanceRef = useRef(null)
  const layersRef = useRef({})

  useEffect(() => {
    if (!mapRef.current) return

    const init = () => {
      const L = window.L
      if (!L || mapInstanceRef.current) return

      // Initialize map centered on Mandera County
      const mandera = [3.9356, 41.8551]
      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView(mandera, 11)

      // Satellite tiles via Esri
      const satellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 18 }
      ).addTo(map)

      // Add zoom control bottom-right
      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // Mock IoT sensor hotspots
      const hotspots = [
        { name: 'Mandera Town Hub', coords: [3.9405, 41.862], level: 0.8 },
        { name: 'Rhamu Corridor', coords: [3.9508, 41.79], level: 0.6 },
        { name: 'Border Crossing Node', coords: [3.92, 41.88], level: 0.7 },
        { name: 'Residential Cluster', coords: [3.955, 41.875], level: 0.5 },
      ]

      const hotspotMarkers = hotspots.map(h => {
        const marker = L.circleMarker(h.coords, {
          radius: 10 + h.level * 10,
          color: '#22c55e',
          weight: 1.5,
          fillColor: '#22c55e',
          fillOpacity: 0.2 + h.level * 0.4,
          className: 'hotspot-marker'
        }).bindTooltip(`${h.name}`, { direction: 'top' })
        marker.addTo(map)
        return marker
      })

      // Vegetation layer (NDVI-like) using tinted tiles (added on demand)
      const veg = L.tileLayer(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        { opacity: 0.0 }
      )

      // Built environment stress layer - simple grid overlay
      const gridLayer = L.gridLayer({
        opacity: 0.65,
        zIndex: 500
      })
      gridLayer.createTile = function(coords) {
        const tile = document.createElement('canvas')
        tile.width = 256; tile.height = 256
        const ctx = tile.getContext('2d')
        const g = ctx.createLinearGradient(0, 0, 256, 256)
        g.addColorStop(0, 'rgba(234, 88, 12, 0.08)')
        g.addColorStop(1, 'rgba(249, 115, 22, 0.18)')
        ctx.fillStyle = g
        ctx.fillRect(0,0,256,256)
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.25)'
        ctx.lineWidth = 1
        for (let i = -256; i < 512; i += 16) {
          ctx.beginPath()
          ctx.moveTo(i, 0)
          ctx.lineTo(i+256, 256)
          ctx.stroke()
        }
        return tile
      }

      // Simple animated heat effect using a canvas overlay tied to map pane
      const overlayCanvas = document.createElement('canvas')
      overlayCanvas.style.position = 'absolute'
      overlayCanvas.style.top = '0'
      overlayCanvas.style.left = '0'
      overlayCanvas.style.pointerEvents = 'none'
      const overlayPane = map.getPane('overlayPane')
      overlayPane.appendChild(overlayCanvas)

      const resize = () => {
        const size = map.getSize()
        overlayCanvas.width = size.x
        overlayCanvas.height = size.y
      }
      map.on('resize', resize)
      resize()

      const octx = overlayCanvas.getContext('2d')
      const drawHeat = () => {
        const w = overlayCanvas.width
        const h = overlayCanvas.height
        octx.clearRect(0,0,w,h)
        const t = Date.now() * 0.001
        const blobs = [
          { x: 0.3 + 0.05*Math.sin(t), y: 0.4, r: 0.25, c1: 'rgba(239,68,68,0.35)', c2:'rgba(250,204,21,0.3)' },
          { x: 0.6, y: 0.5 + 0.03*Math.cos(t*1.2), r: 0.22, c1: 'rgba(250,204,21,0.32)', c2:'rgba(34,197,94,0.28)' },
          { x: 0.45, y: 0.65 + 0.04*Math.sin(t*0.8), r: 0.2, c1: 'rgba(239,68,68,0.3)', c2:'rgba(34,197,94,0.25)' },
        ]
        blobs.forEach(b => {
          const gx = b.x * w
          const gy = b.y * h
          const gr = octx.createRadialGradient(gx, gy, 0, gx, gy, b.r * Math.min(w, h))
          gr.addColorStop(0, b.c1)
          gr.addColorStop(1, b.c2)
          octx.fillStyle = gr
          octx.beginPath()
          octx.arc(gx, gy, b.r * Math.min(w, h), 0, Math.PI*2)
          octx.fill()
        })
        requestAnimationFrame(drawHeat)
      }
      drawHeat()

      layersRef.current = { satellite, veg, gridLayer, hotspotMarkers, overlayCanvas }
      mapInstanceRef.current = map

      // Fix for initial hidden container sizing issues
      setTimeout(() => map.invalidateSize(), 50)
      setReady(true)
    }

    // If Leaflet is already loaded, init immediately; otherwise wait for signal
    if (window.L) {
      init()
    } else {
      const handler = () => init()
      window.addEventListener('leaflet:loaded', handler, { once: true })
      return () => window.removeEventListener('leaflet:loaded', handler)
    }
  }, [])

  useEffect(() => {
    const L = window.L
    const map = mapInstanceRef.current
    if (!L || !map) return

    const { veg, gridLayer } = layersRef.current

    if (activeLayer === 'heat') {
      if (veg && map.hasLayer(veg)) map.removeLayer(veg)
      if (gridLayer && map.hasLayer(gridLayer)) map.removeLayer(gridLayer)
    } else if (activeLayer === 'vegetation') {
      if (veg && !map.hasLayer(veg)) veg.addTo(map)
      if (gridLayer && map.hasLayer(gridLayer)) map.removeLayer(gridLayer)
    } else if (activeLayer === 'built') {
      if (veg && map.hasLayer(veg)) map.removeLayer(veg)
      if (gridLayer && !map.hasLayer(gridLayer)) gridLayer.addTo(map)
    }
  }, [activeLayer])

  return (
    <section className="relative bg-[#07120c]">
      <div className="mx-auto max-w-7xl px-6 md:px-12 py-8 md:py-10">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-2/3">
            <div className="relative h-[52vh] md:h-[64vh] w-full overflow-hidden rounded-2xl border border-emerald-500/20 shadow-[0_10px_40px_rgba(16,185,129,0.25)]">
              <div ref={mapRef} id="map" className="h-full w-full" />

              {!ready && (
                <div className="absolute inset-0 grid place-items-center bg-black/40 text-emerald-100 text-sm">
                  Loading map…
                </div>
              )}

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-emerald-500/10 via-transparent to-transparent" />

              <div className="absolute top-4 left-4 z-[500] flex gap-2">
                {['heat','vegetation','built'].map(key => (
                  <button key={key} onClick={() => setActiveLayer(key)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow ring-1 ring-white/10 backdrop-blur ${activeLayer===key ? 'bg-emerald-500 text-black' : 'bg-black/50 text-emerald-100 hover:bg-black/60'}`}>
                    {key === 'heat' ? 'Heat Index' : key === 'vegetation' ? 'Vegetation' : 'Built Stress'}
                  </button>
                ))}
              </div>

              <div className="absolute bottom-4 left-4 z-[500]">
                <div className="rounded-xl bg-black/60 backdrop-blur px-3 py-2 text-emerald-50 text-xs ring-1 ring-white/10">
                  <div className="font-semibold mb-1">Heat Index</div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 bg-gradient-to-r from-red-500 via-yellow-400 to-emerald-400 rounded" />
                    <span className="opacity-80">Low</span>
                    <span className="ml-auto opacity-80">High</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:w-1/3 space-y-6">
            <div className="rounded-2xl bg-gradient-to-b from-emerald-400/10 to-emerald-500/10 border border-emerald-400/20 p-4 md:p-5 backdrop-blur shadow-[0_10px_30px_rgba(16,185,129,0.2)]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-emerald-100 font-semibold">Real-Time Climate</h3>
                <div className="flex items-center gap-2 text-xs text-emerald-200/80">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Live
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Temp" value="38.6" unit="°C" accent="from-red-500 to-yellow-400" />
                <Stat label="Humidity" value="28" unit="%" accent="from-sky-400 to-emerald-400" />
                <Stat label="Heat Stress" value="0.72" unit="HI" accent="from-orange-500 to-red-500" />
              </div>
            </div>

            <div className="rounded-2xl bg-black/50 border border-emerald-400/20 p-4 md:p-5 backdrop-blur">
              <h3 className="text-emerald-100 font-semibold mb-3">Urban Planning Insights</h3>
              <ul className="space-y-2 text-emerald-100/90 text-sm">
                <li>• Peak heat pockets along transport corridors; prioritize shade corridors.</li>
                <li>• Vegetation buffers near residential clusters reduce HI by ~12%.</li>
                <li>• Target IoT sensors at market hubs to calibrate predictive layers.</li>
              </ul>
            </div>

            <div className="rounded-2xl bg-black/50 border border-emerald-400/20 p-4 md:p-5 backdrop-blur">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-emerald-100 font-semibold">Alerts Feed</h3>
                <span className="text-[10px] text-emerald-300/80">Automated</span>
              </div>
              <div className="space-y-2 text-xs text-emerald-100/90">
                <AlertBadge level="warning" text="Heat advisory: afternoon highs above 39°C expected." />
                <AlertBadge level="info" text="Dry spell persists; monitor water points." />
                <AlertBadge level="watch" text="Localized flash-flood risk near seasonal riverbeds." />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPI label="Citizens Reached" value="128,450" />
          <KPI label="Sensors Online" value="24" />
          <KPI label="Hotspots Tracked" value="18" />
          <KPI label="Municipal Actions" value="7" />
        </div>
      </div>

      <style>{`
        .hotspot-marker { filter: drop-shadow(0 0 10px rgba(16,185,129,0.65)); transition: transform .2s ease; }
        .hotspot-marker:hover { transform: scale(1.1); }
      `}</style>
    </section>
  )
}

function Stat({ label, value, unit, accent }) {
  return (
    <div className="rounded-xl bg-black/50 p-3 ring-1 ring-white/10">
      <div className="text-xs text-emerald-200/80 mb-1">{label}</div>
      <div className="flex items-end gap-1">
        <span className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">{value}</span>
        <span className="text-emerald-200/80 mb-0.5 text-xs">{unit}</span>
      </div>
      <div className={`mt-2 h-1.5 rounded-full bg-gradient-to-r ${accent} animate-pulse`} />
    </div>
  )
}

function AlertBadge({ level, text }) {
  const color = level === 'warning' ? 'from-orange-500 to-red-500' : level === 'watch' ? 'from-yellow-400 to-emerald-400' : 'from-sky-400 to-emerald-400'
  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full bg-gradient-to-r ${color}`} />
      <div className="text-emerald-100/90">{text}</div>
    </div>
  )
}

function KPI({ label, value }) {
  return (
    <div className="rounded-2xl bg-gradient-to-b from-emerald-400/10 to-emerald-500/10 border border-emerald-400/20 p-4 backdrop-blur text-center">
      <div className="text-emerald-200/80 text-xs mb-1">{label}</div>
      <div className="text-2xl font-extrabold text-white">{value}</div>
    </div>
  )
}
