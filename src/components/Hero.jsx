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
    let startTime = 0

    // Planter sweep state: a moving "crew" that plants trees across the scene
    let planterX = 0
    let sweepDir = 1 // 1 -> right, -1 -> left

    const rand = (a,b) => a + Math.random()*(b-a)
    const clamp = (v,a,b) => Math.max(a, Math.min(b, v))

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

      // Density scales with area (lighter on mobile)
      const area = width * height
      const baseDensity = width < 640 ? 0.00009 : 0.00015
      targetCount = Math.max(50, Math.min(550, Math.floor(area * baseDensity)))

      if (trees.length > targetCount) trees.length = targetCount

      // Reset planter sweep
      planterX = width * 0.1
      sweepDir = 1
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

    const spacingOk = (x,y,minDist) => {
      for (let i=0;i<trees.length;i++) {
        const dx = trees[i].x - x
        const dy = trees[i].y - y
        if (dx*dx + dy*dy < minDist*minDist) return false
      }
      return true
    }

    const tryPlaceNear = (px) => {
      // Favor lower band; jitter around planterX to feel like active planting
      const attempts = 10
      for (let k=0;k<attempts;k++) {
        const x = clamp(rand(px-40, px+40), 16, width-16)
        const yBandTop = height * 0.45
        const y = rand(yBandTop, height - 12)
        const minDist = 14
        if (!spacingOk(x,y,minDist)) continue

        const scale = rand(0.75, 1.35)
        const now = performance.now()/1000
        trees.push({
          x, y,
          plantedAt: now,
          growth: 0, // 0..1
          growSpeed: rand(0.018, 0.04),
          trunkHue: rand(22, 28),
          leafHue: rand(135, 155),
          leafVar: rand(-6, 6),
          height: rand(28, 56) * scale,
          crown: rand(15, 30) * scale,
          phase: rand(0, Math.PI*2)
        })
        return true
      }
      return false
    }

    const drawGround = () => {
      // Subtle ground gradient to anchor trees
      const g = ctx.createLinearGradient(0, height*0.4, 0, height)
      g.addColorStop(0, 'rgba(6,24,20,0)')
      g.addColorStop(1, 'rgba(6,24,20,0.45)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, width, height)

      // Horizon haze
      const haze = ctx.createLinearGradient(0, 0, 0, height*0.5)
      haze.addColorStop(0, 'rgba(0,0,0,0.35)')
      haze.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = haze
      ctx.fillRect(0, 0, width, height*0.5)
    }

    const drawPlantingEffect = (t, now) => {
      const age = now - t.plantedAt
      if (age > 1.2) return
      const baseAlpha = 1 - smoothstep(clamp(age/1.2, 0, 1))

      // Soil ring pulse at base
      ctx.save()
      ctx.translate(t.x, t.y)
      ctx.strokeStyle = `rgba(16,185,129,${0.35*baseAlpha})`
      ctx.lineWidth = 2
      ctx.beginPath()
      const r = 4 + 16 * (age/1.2)
      ctx.arc(0, 0, r, 0, Math.PI*2)
      ctx.stroke()

      // Upward shimmer to suggest planting action
      ctx.globalAlpha = 0.3 * baseAlpha
      ctx.fillStyle = 'rgba(16,185,129,0.35)'
      ctx.beginPath()
      ctx.moveTo(-2, -6 - 16*age)
      ctx.lineTo(2, -6 - 16*age)
      ctx.lineTo(0, -18 - 16*age)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    const drawTree = (t, now) => {
      const age = now - t.plantedAt
      const g = t.growth
      if (g <= 0) return

      // Wind sway based on noise
      const wind = (valueNoise2D(t.x*0.01, t.y*0.01, now*0.2) - 0.5) * 2
      const sway = Math.sin(now*1.2 + t.phase) * 0.05 + wind * 0.08

      // Stage-based visuals
      const seedling = g < 0.33
      const sapling = g >= 0.33 && g < 0.75
      const mature = g >= 0.75

      // Sizes scale with growth
      const H = t.height * g
      const R = t.crown * (0.5 + 0.5*Math.min(1, g*1.4))

      ctx.save()
      ctx.translate(t.x, t.y)
      ctx.rotate(sway)

      // Trunk / stem
      ctx.strokeStyle = `hsla(${t.trunkHue}, 40%, 35%, ${0.6 + 0.4*g})`
      ctx.lineCap = 'round'
      ctx.lineWidth = seedling ? 1 : Math.max(1.2, 1.1 + 1.3*g)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(0, -H)
      ctx.stroke()

      // Early leaves as small pair
      const hue = t.leafHue + t.leafVar
      if (seedling) {
        ctx.fillStyle = `hsla(${hue}, 65%, ${28 + g*30}%, ${0.5 + 0.3*g})`
        ctx.beginPath()
        ctx.ellipse(3, -H*0.9, 4, 6, 0.2, 0, Math.PI*2)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(-3, -H*0.9, 4, 6, -0.2, 0, Math.PI*2)
        ctx.fill()
      } else {
        // Simple bifurcated branch near top for sapling/mature
        ctx.beginPath()
        ctx.moveTo(0, -H*0.6)
        ctx.lineTo(R*0.15, -H*0.85)
        ctx.moveTo(0, -H*0.55)
        ctx.lineTo(-R*0.12, -H*0.8)
        ctx.stroke()

        // Canopy: clustered blobs
        const alpha = sapling ? (0.12 + 0.45*g) : (0.18 + 0.5*g)
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
      }

      ctx.restore()

      // Tiny ground shadow
      ctx.save()
      ctx.globalAlpha = 0.2
      ctx.fillStyle = '#000'
      ctx.beginPath()
      const sr = 2 + 6*g
      ctx.ellipse(t.x, t.y+1, sr*1.6, sr, 0, 0, Math.PI*2)
      ctx.fill()
      ctx.restore()

      // Planting sparkle for fresh trees
      drawPlantingEffect(t, now)
    }

    const step = (time) => {
      if (!running) return
      if (!lastTime) { lastTime = time; startTime = time }
      const dt = Math.min(0.05, (time - lastTime)/1000)
      lastTime = time
      const now = time/1000

      // Move planter sweep left-right over time
      const sweepSpeed = Math.max(40, width * 0.08) // px/s
      planterX += sweepDir * sweepSpeed * dt
      if (planterX > width*0.9) { sweepDir = -1 } else if (planterX < width*0.1) { sweepDir = 1 }

      // Plant new trees gradually along the sweep to feel actively planted
      const maxRate = 7 // per second
      let toPlant = Math.min(targetCount - trees.length, Math.floor(maxRate * dt * (0.75 + Math.random()*0.5)))
      while (toPlant-- > 0) {
        if (!tryPlaceNear(planterX)) break
      }

      // Clear
      ctx.clearRect(0, 0, width, height)

      // Ground
      drawGround()

      // Sort by y to fake depth (farther first)
      trees.sort((a,b) => a.y - b.y)

      // Update growth & draw
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
      {/* Tree planting background animation (seedling -> sapling -> mature) */}
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
