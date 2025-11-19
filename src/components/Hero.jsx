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
    let running = true

    // Forest state
    let trees = []
    let targetCount = 0
    let lastTime = 0
    const rand = (a,b) => a + Math.random()*(b-a)

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

      // Density scales with area
      const area = width * height
      const density = 0.00015 // trees per pixel
      targetCount = Math.max(60, Math.min(600, Math.floor(area * density)))

      // Keep previously planted trees if any, reduce if too many
      if (trees.length > targetCount) trees.length = targetCount
    }

    // Simple value noise for wind sway
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

    const tryPlace = () => {
      // Place with simple minimum spacing to avoid heavy clustering
      const attempts = 8
      for (let k=0;k<attempts;k++) {
        const x = rand(20, width-20)
        // favor lower half to look like horizon-to-foreground planting
        const y = rand(height*0.35, height-10)
        const minDist = 12
        let ok = true
        for (let i=0;i<trees.length;i++) {
          const dx = trees[i].x - x
          const dy = trees[i].y - y
          if (dx*dx + dy*dy < minDist*minDist) { ok = false; break }
        }
        if (ok) {
          const scale = rand(0.7, 1.4)
          trees.push({
            x, y,
            growth: 0, // 0..1
            growSpeed: rand(0.025, 0.06),
            trunkHue: rand(22, 28),
            leafHue: rand(135, 155), // emerald greens
            leafVar: rand(-6, 6),
            height: rand(26, 52) * scale,
            crown: rand(14, 28) * scale,
            phase: rand(0, Math.PI*2)
          })
          return
        }
      }
    }

    const drawGround = () => {
      // Subtle ground gradient to anchor trees
      const g = ctx.createLinearGradient(0, height*0.4, 0, height)
      g.addColorStop(0, 'rgba(6,24,20,0)')
      g.addColorStop(1, 'rgba(6,24,20,0.45)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, width, height)
    }

    const drawTree = (t, now) => {
      const g = t.growth
      if (g <= 0) return

      // Wind sway based on noise
      const wind = (valueNoise2D(t.x*0.01, t.y*0.01, now*0.2) - 0.5) * 2
      const sway = Math.sin(now*1.2 + t.phase) * 0.05 + wind * 0.08

      // Sizes scale with growth
      const H = t.height * g
      const R = t.crown * (0.6 + 0.4*Math.min(1, g*1.5))

      // Trunk
      ctx.save()
      ctx.translate(t.x, t.y)
      ctx.rotate(sway)
      ctx.strokeStyle = `hsla(${t.trunkHue}, 40%, 35%, ${0.6 + 0.4*g})`
      ctx.lineWidth = Math.max(1, 1.1 + 1.2*g)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(0, -H)
      ctx.stroke()

      // Simple bifurcated branch near top
      ctx.beginPath()
      ctx.moveTo(0, -H*0.6)
      ctx.lineTo(R*0.15, -H*0.85)
      ctx.moveTo(0, -H*0.55)
      ctx.lineTo(-R*0.12, -H*0.8)
      ctx.stroke()

      // Canopy: clustered blobs
      const hue = t.leafHue + t.leafVar
      const alpha = 0.15 + 0.5*g
      const light = 28 + g*24
      ctx.fillStyle = `hsla(${hue}, 55%, ${light}%, ${alpha})`

      const cx = 0
      const cy = -H
      const blobs = [
        {dx:0, dy:0, r:R},
        {dx:R*0.4, dy:-R*0.2, r:R*0.75},
        {dx:-R*0.45, dy:-R*0.1, r:R*0.7},
        {dx:0, dy:R*0.2, r:R*0.6},
      ]
      blobs.forEach(b => {
        ctx.beginPath()
        ctx.arc(cx + b.dx, cy + b.dy, b.r, 0, Math.PI*2)
        ctx.fill()
      })

      // Highlight edge for depth
      const grad = ctx.createRadialGradient(cx+R*0.3, cy-R*0.6, R*0.1, cx, cy, R*1.6)
      grad.addColorStop(0, `hsla(${hue}, 70%, ${light+18}%, ${alpha*0.8})`)
      grad.addColorStop(1, 'hsla(0,0%,0%,0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(cx, cy, R*1.4, 0, Math.PI*2)
      ctx.fill()

      ctx.restore()
    }

    const step = (time) => {
      if (!running) return
      if (!lastTime) lastTime = time
      const dt = Math.min(0.05, (time - lastTime)/1000)
      lastTime = time
      const now = time/1000

      // Plant new trees gradually to feel like ongoing restoration
      const plantRate = 6 // per second max
      const toPlant = Math.min(targetCount - trees.length, Math.floor(plantRate * dt * (0.5 + Math.random())))
      for (let i=0;i<toPlant;i++) tryPlace()

      // Clear fully (no trails for trees)
      ctx.clearRect(0, 0, width, height)

      // Ground
      drawGround()

      // Sort by y to fake depth (farther first)
      trees.sort((a,b) => a.y - b.y)

      // Update & draw
      for (let i=0;i<trees.length;i++) {
        const tObj = trees[i]
        if (tObj.growth < 1) tObj.growth = Math.min(1, tObj.growth + tObj.growSpeed * dt * 60)
        drawTree(tObj, now)
      }

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
      {/* Tree planting background animation */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Subtle gradient glow layers retained for depth */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-700/20 via-emerald-500/10 to-transparent" />
        <div className="absolute -inset-1 blur-3xl opacity-40">
          <div className="w-full h-full bg-gradient-to-tr from-emerald-600/15 via-emerald-400/10 to-sky-500/10 animate-[spin_24s_linear_infinite] rounded-full" />
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
