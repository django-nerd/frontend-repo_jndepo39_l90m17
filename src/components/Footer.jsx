import React from 'react'

export default function Footer() {
  return (
    <footer className="border-t border-emerald-500/10 bg-black text-emerald-100/80">
      <div className="mx-auto max-w-7xl px-6 md:px-12 py-6 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="text-sm">© {new Date().getFullYear()} ThermaMap • Mandera County</div>
        <div className="text-xs opacity-80">Esoteric Strats / AIVERSE — Africa-first climate intelligence</div>
      </div>
    </footer>
  )
}
