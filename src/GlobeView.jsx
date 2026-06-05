import { useCallback, useEffect, useRef, useState } from "react"
import Globe from "globe.gl"
import * as THREE from "three"
import * as satellite from "satellite.js"

import { Card } from "./components/ui/card"
import { Button } from "./components/ui/button"
import { Sidebar } from "./components/layout/Sidebar"

export default function GlobeView() {
  const ref = useRef(null)

  const toNoradId = value => {
    if (value === null || value === undefined || value === "") return null

    const num = Number(value)
    return Number.isFinite(num) ? num : null
  }

  const [selectedSat, setSelectedSat] = useState(null)
  const [satCatalog, setSatCatalog] = useState([])
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem("favorites")
    if (!saved) return []

    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        return parsed
          .map(toNoradId)
          .filter(value => value !== null)
      }

      const first = toNoradId(parsed)
      return first !== null ? [first] : []
    } catch {
      return []
    }
  })
  const favoritesRef = useRef(favorites)

  const followSatRef = useRef(null)
  const satMeta = useRef(new Map())

  const setVisibleOrbit = useCallback(targetMeta => {
    for (const meta of satMeta.current.values()) {
      if (meta.orbitLine) {
        meta.orbitLine.visible = meta === targetMeta
      }
    }
  }, [])

  const focusSatellite = useCallback(meta => {
    if (!meta) return

    followSatRef.current = meta.mesh
    setSelectedSat(meta)
    setVisibleOrbit(meta)
  }, [setVisibleOrbit])

  const handleSelectSatellite = useCallback(sat => {
    if (!sat?.mesh) return

    const meta = satMeta.current.get(sat.mesh)
    if (meta) {
      focusSatellite(meta)
    }
  }, [focusSatellite])

  // ------------------------------------------------------------
  // GLOBE INITIALISIERUNG
  // ------------------------------------------------------------
  useEffect(() => {
    if (!ref.current) return

    ref.current.innerHTML = ""
    ref.current.style.position = "relative"
    ref.current.style.overflow = "hidden"

    const globe = Globe()(ref.current)
      .globeImageUrl("//unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
      .backgroundImageUrl("//unpkg.com/three-globe/example/img/night-sky.png")

    const scene = globe.scene()
    const camera = globe.camera()
    const renderer = globe.renderer()
    const R = globe.getGlobeRadius()

    renderer.domElement.style.position = "absolute"
    renderer.domElement.style.inset = "0"
    renderer.domElement.style.width = "100%"
    renderer.domElement.style.height = "100%"
    renderer.domElement.style.display = "block"

    const resizeGlobe = () => {
      if (!ref.current) return

      const width = ref.current.clientWidth
      const height = ref.current.clientHeight

      if (width > 0 && height > 0) {
        globe.width(width)
        globe.height(height)
        renderer.setSize(width, height, false)
      }
    }

    resizeGlobe()

    const resizeObserver = new ResizeObserver(resizeGlobe)
    resizeObserver.observe(ref.current)
    window.addEventListener("resize", resizeGlobe)

    const orbitGroup = new THREE.Group()
    const satGroup = new THREE.Group()
    scene.add(orbitGroup)
    scene.add(satGroup)

    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    // ------------------------------------------------------------
    // Kamera-Animation
    // ------------------------------------------------------------
    function animateCameraTo(targetPos) {
      const start = camera.position.clone()
      const end = targetPos.clone().multiplyScalar(1.8)

      let t = 0
      const step = 0.08

      function animate() {
        t += step
        if (t >= 1) {
          camera.position.copy(end)
          camera.lookAt(0, 0, 0)
          return
        }
        camera.position.lerpVectors(start, end, t)
        camera.lookAt(0, 0, 0)
        requestAnimationFrame(animate)
      }

      animate()
    }

    // ------------------------------------------------------------
    // STARLINK LADEN
    // ------------------------------------------------------------
    fetch("https://api.spacexdata.com/v4/starlink")
      .then(res => res.json())
      .then(data => {
        const sats = data.filter(s => s.spaceTrack?.TLE_LINE1 && s.spaceTrack?.TLE_LINE2)
        const catalog = []

        sats.forEach(sat => {
          try {
            const tle1 = sat.spaceTrack.TLE_LINE1
            const tle2 = sat.spaceTrack.TLE_LINE2
            const satrec = satellite.twoline2satrec(tle1, tle2)

            // ------------------------------------------------------------
            // SATELLITENPUNKT
            // ------------------------------------------------------------
            const norad = toNoradId(sat.spaceTrack.NORAD_CAT_ID ?? sat.spaceTrack.OBJECT_NUMBER)

            if (norad === null) {
              return
            }

            const satMesh = new THREE.Mesh(
              new THREE.SphereGeometry(0.01 * R, 8, 8),
              new THREE.MeshBasicMaterial({ color: favoritesRef.current.includes(norad) ? "orange" : "yellow" })
            )
            satGroup.add(satMesh)

            // ------------------------------------------------------------
            // ORBIT BERECHNEN
            // ------------------------------------------------------------
            const points = []
            const now = new Date()

            for (let m = -45; m <= 45; m += 3) {
              const time = new Date(now.getTime() + m * 60000)
              const gmst = satellite.gstime(time)
              const pv = satellite.propagate(satrec, time)
              if (!pv?.position) continue

              const gd = satellite.eciToGeodetic(pv.position, gmst)
              const lat = satellite.radiansToDegrees(gd.latitude)
              const lng = satellite.radiansToDegrees(gd.longitude)
              const alt = Math.max(0.01, gd.height / 6371)

              const phi = (90 - lat) * Math.PI / 180
              const theta = (lng + 180) * Math.PI / 180
              const r = R * (1 + alt)

              points.push(
                new THREE.Vector3(
                  r * Math.sin(phi) * Math.cos(theta),
                  r * Math.cos(phi),
                  r * Math.sin(phi) * Math.sin(theta)
                )
              )
            }

            if (points.length >= 2) {
              const geometry = new THREE.BufferGeometry().setFromPoints(points)
              const material = new THREE.LineBasicMaterial({ color: "cyan" })
              const orbitLine = new THREE.Line(geometry, material)
              orbitLine.visible = false
              orbitGroup.add(orbitLine)

              satMeta.current.set(satMesh, {
                name: sat.spaceTrack.OBJECT_NAME,
                noradId: norad,
                objectId: sat.spaceTrack.OBJECT_ID,
                tle1,
                tle2,
                mesh: satMesh,
                orbitLine
              })
            }

            if (!satMeta.current.has(satMesh)) {
              satMeta.current.set(satMesh, {
                name: sat.spaceTrack.OBJECT_NAME,
                noradId: norad,
                objectId: sat.spaceTrack.OBJECT_ID,
                tle1,
                tle2,
                mesh: satMesh,
                orbitLine: null
              })
            }

            catalog.push({
              name: sat.spaceTrack.OBJECT_NAME,
              noradId: norad,
              objectId: sat.spaceTrack.OBJECT_ID,
              mesh: satMesh
            })

            // ------------------------------------------------------------
            // LIVE POSITION
            // ------------------------------------------------------------
            function updateSat() {
              const time = new Date()
              const gmst = satellite.gstime(time)
              const pv = satellite.propagate(satrec, time)
              if (!pv?.position) return

              const gd = satellite.eciToGeodetic(pv.position, gmst)
              const lat = satellite.radiansToDegrees(gd.latitude)
              const lng = satellite.radiansToDegrees(gd.longitude)
              const alt = Math.max(0.01, gd.height / 6371)

              const phi = (90 - lat) * Math.PI / 180
              const theta = (lng + 180) * Math.PI / 180
              const r = R * (1 + alt)

              satMesh.position.set(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.cos(phi),
                r * Math.sin(phi) * Math.sin(theta)
              )

              if (followSatRef.current === satMesh) {
                animateCameraTo(satMesh.position)
              }
            }

            updateSat()
            setInterval(updateSat, 1000)
          } catch (err) {
            console.warn("Fehler bei Satellit:", err)
          }
        })

        setSatCatalog(catalog)
      })

    // ------------------------------------------------------------
    // KLICK-EVENT
    // ------------------------------------------------------------
    function onClick(event) {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(satGroup.children, true)

      if (intersects.length > 0) {
        const mesh = intersects[0].object
        const meta = satMeta.current.get(mesh)
        if (meta) {
          focusSatellite(meta)
        }
      } else {
        setSelectedSat(null)
        followSatRef.current = null
        setVisibleOrbit(null)
      }
    }

    renderer.domElement.addEventListener("pointerdown", onClick)
    return () => {
      renderer.domElement.removeEventListener("pointerdown", onClick)
      resizeObserver.disconnect()
      window.removeEventListener("resize", resizeGlobe)
    }
  }, [focusSatellite, setVisibleOrbit])

  useEffect(() => {
    for (const meta of satMeta.current.values()) {
      if (meta?.mesh?.material?.color) {
        meta.mesh.material.color.set(favorites.includes(meta.noradId) ? "orange" : "yellow")
      }
    }
  }, [favorites])

  // ------------------------------------------------------------
  // FAVORITEN
  // ------------------------------------------------------------
  function toggleFavorite(noradId) {
    setFavorites(current => {
      const updated = current.includes(noradId)
        ? current.filter(id => id !== noradId)
        : [...current, noradId]

      favoritesRef.current = updated
      localStorage.setItem("favorites", JSON.stringify(updated))
      return updated
    })
  }

  function focusFavorite(noradId) {
    for (const meta of satMeta.current.values()) {
      if (meta.noradId === noradId) {
        focusSatellite(meta)
      }
    }
  }

  // ------------------------------------------------------------
  // UI RENDER
  // ------------------------------------------------------------
  return (
    <div
      className="relative w-full h-full overflow-hidden lg:grid lg:grid-cols-[20vw_minmax(0,1fr)] min-h-0"
      style={{
        display: "grid",
        gridTemplateColumns: "15vw minmax(0, 1fr)",
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >

      <Sidebar
        satCatalog={satCatalog}
        selectedSat={selectedSat}
        favorites={favorites}
        onSelectSatellite={handleSelectSatellite}
        onToggleFavorite={toggleFavorite}
        onSelectFavorite={focusFavorite}
      />

      {/* Globe */}
      <div
        className="relative min-w-0 h-full overflow-hidden"
        style={{
          position: "relative",
          minWidth: 0,
          minHeight: 0,
          overflow: "hidden",
          display: "block",
        }}
      >
        <div
          ref={ref}
          className="w-full h-full z-0"
          style={{
            width: "100%",
            height: "100%",
            position: "absolute",
            inset: 0,
            margin: 0,
          }}
        />

      {/* Popup rechts */}
      {selectedSat && (
        <Card className="absolute right-4 top-4 max-w-xs 
          bg-[var(--cyber-panel)] backdrop-blur-xl 
          border border-[var(--cyber-border)] 
          shadow-[var(--cyber-glow)] text-[var(--cyber-text)] z-20">

          <div className="px-3 pt-3 pb-1">
            <div className="font-semibold text-sm truncate text-cyan-300">
              {selectedSat.name}
            </div>
            <div className="text-xs text-cyan-300/60">
              NORAD ID: {selectedSat.noradId}
            </div>
          </div>

          <div className="px-3 pb-2 flex gap-2">
            <Button
              size="sm"
              className="text-xs border border-cyan-500/40 text-cyan-300 
                hover:bg-cyan-500/10 transition"
              variant="outline"
              onClick={() => toggleFavorite(selectedSat.noradId)}
            >
              {favorites.includes(selectedSat.noradId) ? "★ Favorit" : "☆ Favorit"}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="text-xs ml-auto text-cyan-300 hover:bg-cyan-500/10"
              onClick={() => {
                followSatRef.current = null
                setSelectedSat(null)
              }}
            >
              Schließen
            </Button>
          </div>
        </Card>
      )}

      </div>

    </div>
  )
}
