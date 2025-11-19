import React, { useEffect, useRef } from 'react'

export default function Hero() {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })

    let width = 0, height = 0, dpr = Math.min(window.devicePixelRatio || 1, 2)
    let particles = []
    let running = true

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect()
      width = Math.floor(rect.width)
      height = Math.floor(rect.height)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = width + 'px'
      canvas.style.height = height + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Rebuild particles on resize for density consistency
      buildParticles()
      // Prime background
      ctx.fillStyle = 'rgba(0,0,0,0)'
      ctx.fillRect(0,0,width,height)
    }

    const rand = (a,b) => a + Math.random()*(b-a)

    const buildParticles = () => {
      const area = width * height
      const density = Math.min(0.00008, 0.00012) // base density bounds
      const target = Math.max(60, Math.min(220, Math.floor(area * density))) // scale with area
      particles = new Array(target).fill(0).map(() => ({
        x: rand(0,width),
        y: rand(0,height),
        life: rand(200, 600),
        age: rand(0, 600),
        speed: rand(0.3, 1.1),
        size: rand(0.6, 1.8),
        hue: rand(145, 175), // emerald-ish
      }))
    }

    // Smooth pseudo-noise field inspired by curl noise (cheap variant)
    const field = (x, y, t) => {
      const s = 0.0009 // spatial scale
      const a = Math.sin((x + t*1200) * s) + Math.cos((y - t*900) * s * 0.9)
      const b = Math.cos((x - t*600) * s * 1.1) - Math.sin((y + t*700) * s)
      // steer vector
      return [a, b]
    }

    const step = (time) => {
      if (!running) return
      const t = time * 0.001

      // subtle fade to create trails
      ctx.fillStyle = 'rgba(2, 6, 4, 0.06)'
      ctx.fillRect(0, 0, width, height)

      for (let p of particles) {
        const [vx, vy] = field(p.x, p.y, t)
        p.x += vx * p.speed * 1.4
        p.y += vy * p.speed * 1.4

        // wrap around edges
        if (p.x < -5) p.x = width + 5
        if (p.x > width + 5) p.x = -5
        if (p.y < -5) p.y = height + 5
        if (p.y > height + 5) p.y = -5

        // draw
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 18*p.size)
        grad.addColorStop(0, `hsla(${p.hue}, 90%, 60%, 0.38)`)
        grad.addColorStop(1, 'hsla(160, 90%, 60%, 0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(p.x, p.y, 18*p.size, 0, Math.PI*2)
        ctx.fill()

        // age and respawn
        p.age += 1
        if (p.age > p.life) {
          p.x = rand(0,width)
          p.y = rand(0,height)
          p.life = rand(200, 600)
          p.age = 0
          p.speed = rand(0.3, 1.1)
          p.size = rand(0.6, 1.8)
          p.hue = rand(145, 175)
        }
      }

      rafRef.current = requestAnimationFrame(step)
    }

    // Optimize for tab switching
    const visHandler = () => {
      running = document.visibilityState !== 'hidden'
      if (running) rafRef.current = requestAnimationFrame(step)
      else if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }

    resize()
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', visHandler)
    rafRef.current = requestAnimationFrame(step)

    return () => {
      running = false
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', visHandler)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <section className="relative h-[48vh] md:h-[60vh] w-full overflow-hidden bg-black">
      {/* Environmental climate mass animation */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Animated gradient glow layers */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-700/25 via-emerald-500/10 to-transparent" />
        <div className="absolute -inset-1 blur-3xl opacity-50">
          <div className="w-full h-full bg-gradient-to-tr from-emerald-600/20 via-emerald-400/10 to-sky-500/10 animate-[spin_18s_linear_infinite] rounded-full" />
        </div>
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
