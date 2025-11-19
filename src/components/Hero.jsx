import React, { useEffect, useRef } from 'react'

export default function Hero() {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })

    let width = 0, height = 0
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let particles = []
    let running = true

    // Performance trackers
    let lastTime = 0
    let fpsEMA = 60

    // Utility
    const rand = (a,b) => a + Math.random()*(b-a)
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect()
      width = Math.max(1, Math.floor(rect.width))
      height = Math.max(1, Math.floor(rect.height))
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = width + 'px'
      canvas.style.height = height + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      buildParticles(true)
      // prime
      ctx.clearRect(0,0,width,height)
    }

    // Lightweight value noise (tile-free enough for our scale)
    const hash = (x, y, t) => {
      const s = Math.sin(x*127.1 + y*311.7 + t*0.123) * 43758.5453
      return s - Math.floor(s)
    }
    const smoothstep = (x) => x*x*(3 - 2*x)
    const valueNoise2D = (x, y, t) => {
      const xi = Math.floor(x), yi = Math.floor(y)
      const xf = x - xi, yf = y - yi
      const tl = hash(xi, yi, t)
      const tr = hash(xi+1, yi, t)
      const bl = hash(xi, yi+1, t)
      const br = hash(xi+1, yi+1, t)
      const u = smoothstep(xf)
      const v = smoothstep(yf)
      const top = tl*(1-u) + tr*u
      const bot = bl*(1-u) + br*u
      return top*(1-v) + bot*v
    }

    // Approximate curl of scalar noise by rotating gradient 90 degrees
    // Gives a divergence-free field for fluid-like motion
    const curlNoise = (x, y, t, scale=0.0035) => {
      const eps = 0.0005
      const nx = x*scale, ny = y*scale
      const n1 = valueNoise2D(nx+eps, ny, t)
      const n2 = valueNoise2D(nx-eps, ny, t)
      const n3 = valueNoise2D(nx, ny+eps, t)
      const n4 = valueNoise2D(nx, ny-eps, t)
      const dndx = (n1 - n2) / (2*eps)
      const dndy = (n3 - n4) / (2*eps)
      // rotate gradient to get curl-like field (dy, -dx)
      return [dndy, -dndx]
    }

    // Mesoscale wind front that slowly drifts; add slight Coriolis twist (Mandera ~4°N)
    const windField = (x, y, t) => {
      // Base trade-like wind predominantly E->W with diurnal modulation
      const diurnal = Math.sin(t * 0.2) * 0.3 + 0.7
      const base = [0.8 * diurnal, 0.05]

      // Slow-moving frontal boundary sweeping across scene
      const frontX = (Math.sin(t*0.05) * 0.5 + 0.5) * width
      const frontFactor = Math.tanh((x - frontX) / (0.22*width)) // -1..1 across the front
      const shear = [ -0.35*frontFactor, 0.25*frontFactor ]

      // Curl noise adds eddies/turbulence
      const [cx, cy] = curlNoise(x, y, t*0.35, 0.0025)

      // Slight Coriolis-like rotation (small near equator)
      const coriolis = 0.015
      const rotX = -coriolis * (y - height*0.5) / height
      const rotY = coriolis * (x - width*0.5) / width

      return [base[0] + shear[0] + cx*1.8 + rotX, base[1] + shear[1] + cy*1.8 + rotY]
    }

    const buildParticles = (keepCount=false) => {
      const area = width * height
      const baseDensity = 0.00010 // tuned baseline
      const target = Math.max(80, Math.min(380, Math.floor(area * baseDensity)))
      const nextCount = keepCount ? particles.length : target
      const count = keepCount ? clamp(nextCount, Math.floor(target*0.8), Math.floor(target*1.2)) : target

      if (particles.length > count) {
        particles.length = count
        return
      }
      for (let i = particles.length; i < count; i++) {
        particles.push(spawnParticle())
      }
    }

    const spawnParticle = () => {
      const size = rand(0.6, 1.8)
      const speed = rand(0.5, 1.4)
      return {
        x: rand(0,width),
        y: rand(0,height),
        vx: rand(-0.2, 0.2),
        vy: rand(-0.2, 0.2),
        life: rand(500, 1400),
        age: rand(0, 1400),
        size,
        mass: size * rand(0.6, 1.3),
        baseHue: rand(150, 170) // emerald base
      }
    }

    const step = (time) => {
      if (!running) return
      if (!lastTime) lastTime = time
      const dt = (time - lastTime) / 1000 // seconds
      lastTime = time
      const fps = 1 / Math.max(0.016, dt)
      fpsEMA = 0.1*fps + 0.9*fpsEMA

      // Adaptive trail fade: more fade at low FPS to avoid smearing
      const fade = clamp(0.06 + (60 - clamp(fpsEMA, 20, 60)) * 0.0035, 0.06, 0.18)
      ctx.fillStyle = `rgba(2,6,4,${fade})`
      ctx.fillRect(0, 0, width, height)

      ctx.globalCompositeOperation = 'lighter'

      const t = time * 0.001

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        // Field acceleration
        const [fx, fy] = windField(p.x, p.y, t)

        // Add small random gusts tied to field coherence
        const gust = valueNoise2D(p.x*0.01, p.y*0.01, t*0.5)
        const gx = (gust - 0.5) * 0.15
        const gy = (gust - 0.5) * 0.08

        // Integrate velocity with drag (semi-implicit Euler)
        const drag = 0.92
        p.vx = p.vx*drag + (fx + gx) * (0.6 / p.mass)
        p.vy = p.vy*drag + (fy + gy) * (0.6 / p.mass)

        p.x += p.vx
        p.y += p.vy

        // Wrap
        if (p.x < -5) p.x = width + 5
        if (p.x > width + 5) p.x = -5
        if (p.y < -5) p.y = height + 5
        if (p.y > height + 5) p.y = -5

        // Visuals: speed-based hue shift and brightness
        const sp = Math.hypot(p.vx, p.vy)
        const heat = clamp((sp - 0.4) / 1.8, 0, 1) // 0..1
        const hue = p.baseHue * (1 - heat) + 30 * heat // emerald -> amber at high speed
        const alpha = 0.22 + heat * 0.26
        const r = 20 * p.size * (1 + heat*0.6)

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
        grad.addColorStop(0, `hsla(${hue}, 90%, ${60 + heat*20}%, ${alpha})`)
        grad.addColorStop(1, `hsla(${hue}, 90%, 60%, 0)`)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI*2)
        ctx.fill()

        p.age += 1
        if (p.age > p.life) particles[i] = spawnParticle()
      }

      ctx.globalCompositeOperation = 'source-over'

      rafRef.current = requestAnimationFrame(step)
    }

    const visHandler = () => {
      running = document.visibilityState !== 'hidden'
      if (running) {
        lastTime = 0
        rafRef.current = requestAnimationFrame(step)
      } else if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
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
