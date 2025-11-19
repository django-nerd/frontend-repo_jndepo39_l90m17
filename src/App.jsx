import React from 'react'
import Hero from './components/Hero'
import MapSection from './components/MapSection'
import Footer from './components/Footer'
import HeadIncludes from './components/HeadIncludes'

function App() {
  return (
    <div className="min-h-screen bg-[#030705] text-white">
      <HeadIncludes />
      {/* Hero with Spline */}
      <Hero />

      {/* Brand strip */}
      <section className="bg-gradient-to-r from-emerald-900/40 via-emerald-700/20 to-emerald-900/40 border-y border-emerald-500/10">
        <div className="mx-auto max-w-7xl px-6 md:px-12 py-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="text-emerald-100/90 text-sm">
            Africa deserves cutting-edge, localized climate intelligence.
          </div>
          <div className="flex items-center gap-4 opacity-90">
            <div className="h-8 w-8 rounded bg-emerald-400/20 ring-1 ring-emerald-400/30" />
            <div className="text-emerald-100/80 text-xs">Esoteric Strats</div>
            <div className="h-8 w-8 rounded bg-emerald-400/20 ring-1 ring-emerald-400/30" />
            <div className="text-emerald-100/80 text-xs">AIVERSE</div>
          </div>
        </div>
      </section>

      {/* Map + Panels */}
      <MapSection />

      {/* Footer */}
      <Footer />
    </div>
  )
}

export default App
