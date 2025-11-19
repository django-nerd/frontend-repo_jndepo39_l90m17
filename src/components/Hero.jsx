import React from 'react'
import Spline from '@splinetool/react-spline'

export default function Hero() {
  return (
    <section className="relative h-[48vh] md:h-[60vh] w-full overflow-hidden bg-black">
      <div className="absolute inset-0">
        <Spline scene="https://prod.spline.design/6tUXqVcUA0xgJugv/scene.splinecode" style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Gradient edge overlays */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-black/10 to-black" />

      <div className="relative z-10 h-full flex items-end md:items-center">
        <div className="w-full px-6 md:px-12 lg:px-16 pb-6 md:pb-0">
          <div className="max-w-5xl">
            <div className="inline-flex items-center gap-3 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-1.5 text-emerald-200 shadow-[0_0_30px_rgba(16,185,129,0.25)]">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Live climate intelligence • Mandera County, Kenya
            </div>
            <h1 className="mt-4 text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white">
              ThermaMap — Mandera Climate Dashboard
            </h1>
            <p className="mt-3 md:mt-4 text-emerald-100/90 text-base md:text-lg">
              Powered by <span className="font-semibold text-white">Esoteric Strats</span> / <span className="font-semibold text-white">AIVERSE</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
