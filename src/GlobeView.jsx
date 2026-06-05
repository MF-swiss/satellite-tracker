import { useCallback, useEffect, useRef, useState } from "react"
import Globe from "globe.gl"
import * as THREE from "three"
import * as satellite from "satellite.js"

import { Card } from "./components/ui/card"
import { Button } from "./components/ui/button"
import { ScrollArea } from "./components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "./components/ui/sheet"
import { Sidebar } from "./components/layout/Sidebar"

export default function GlobeView() {
  const ref = useRef(null)

  const [selectedSat, setSelectedSat] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortMode, setSortMode] = useState("name")
  const [satCatalog, setSatCatalog] = useState([])
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem("favorites")
    return saved ? JSON.parse(saved) : []
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
    setSearchQuery(meta.name)
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

    const globe = Globe()(ref.current)
      .globeImageUrl("//unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
      .backgroundImageUrl("//unpkg.com/three-globe/example/img/night-sky.png")

    const scene = globe.scene()
    const camera = globe.camera()
    const renderer = globe.renderer()
    const R = globe.getGlobeRadius()

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
            const norad = sat.spaceTrack.OBJECT_NUMBER

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
              if (!pv.position) continue

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
              if (!pv.position) return

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
    return () => renderer.domElement.removeEventListener("pointerdown", onClick)
  }, [focusSatellite, setVisibleOrbit])

  // ------------------------------------------------------------
  // FAVORITEN
  // ------------------------------------------------------------
  function toggleFavorite(noradId) {
    let updated
    if (favorites.includes(noradId)) {
      updated = favorites.filter(id => id !== noradId)
    } else {
      updated = [...favorites, noradId]
    }

    setFavorites(updated)
    favoritesRef.current = updated
    localStorage.setItem("favorites", JSON.stringify(updated))

    for (const meta of satMeta.current.values()) {
      if (meta.noradId === noradId) {
        meta.mesh.material.color.set(updated.includes(noradId) ? "orange" : "yellow")
      }
    }
  }

  function focusFavorite(noradId) {
    for (const meta of satMeta.current.values()) {
      if (meta.noradId === noradId) {
        focusSatellite(meta)
      }
    }
  }

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const compareCatalog = (a, b) => {
    if (sortMode === "norad") {
      return Number(a.noradId) - Number(b.noradId)
    }

    if (sortMode === "objectId") {
      return (a.objectId ?? "").localeCompare(b.objectId ?? "")
    }

    return (a.name ?? "").localeCompare(b.name ?? "")
  }

  const visibleCatalog = satCatalog
    .filter(sat => {
      if (!normalizedQuery) return true

      const name = sat.name?.toLowerCase() ?? ""
      const objectId = sat.objectId?.toLowerCase() ?? ""
      const noradId = String(sat.noradId)

      return (
        name.includes(normalizedQuery) ||
        objectId.includes(normalizedQuery) ||
        noradId.includes(normalizedQuery)
      )
    })
    .sort(compareCatalog)

  // ------------------------------------------------------------
  // UI RENDER
  // ------------------------------------------------------------
  return (
    <div className="relative w-full h-full overflow-hidden">

      {/* Globe */}
      <div ref={ref} className="absolute inset-0 z-0" />

      <Sidebar
        satCatalog={satCatalog}
        selectedSat={selectedSat}
        favorites={favorites}
        onSelectSatellite={handleSelectSatellite}
        onToggleFavorite={toggleFavorite}
        onSelectFavorite={focusFavorite}
      />

      {/* Mobile Sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="lg:hidden absolute left-4 top-4 z-30 
              border border-cyan-500/40 text-cyan-300 
              bg-[var(--cyber-panel)] backdrop-blur-xl 
              hover:bg-cyan-500/10 transition"
          >
            🛰️ Satelliten
          </Button>
        </SheetTrigger>

        <SheetContent side="left" className="w-64 p-3 
          bg-[var(--cyber-panel)] backdrop-blur-xl 
          border-r border-[var(--cyber-border)] 
          shadow-[var(--cyber-glow)] text-[var(--cyber-text)]">

          <div className="mb-3 border-b border-white/10 pb-3">
            <div className="font-semibold text-sm mb-2 text-cyan-300">
              🛰️ Satelliten-Navigation
            </div>

            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Suchen: Name, Objekt-ID, NORAD"
              className="w-full rounded-md border border-cyan-500/30 bg-black/20 px-3 py-2 text-xs text-[var(--cyber-text)] outline-none placeholder:text-cyan-300/40 focus:border-cyan-300/70"
            />

            <div className="mt-3 flex items-center gap-2">
              <label className="text-[10px] uppercase tracking-wider text-cyan-300/60">
                Sortierung
              </label>
              <select
                value={sortMode}
                onChange={e => setSortMode(e.target.value)}
                className="ml-auto rounded-md border border-cyan-500/30 bg-black/20 px-2 py-1 text-xs text-[var(--cyber-text)] outline-none"
              >
                <option value="name">Name</option>
                <option value="norad">NORAD</option>
                <option value="objectId">Objekt-ID</option>
              </select>
            </div>
          </div>

          <div className="mb-2 text-xs text-cyan-300/70 flex items-center gap-2">
            <span>{visibleCatalog.length} Satelliten</span>
            {normalizedQuery && <span className="text-cyan-300/40">• gefiltert</span>}
          </div>

          <ScrollArea className="h-[52vh] mb-3">
            {visibleCatalog.length === 0 ? (
              <div className="text-xs text-cyan-300/60 px-1 py-1">
                Keine Treffer.
              </div>
            ) : (
              visibleCatalog.slice(0, 200).map(sat => {
                const isSelected = selectedSat?.noradId === sat.noradId
                return (
                  <button
                    key={sat.noradId}
                    className={`w-full text-left flex items-center justify-between px-2 py-2 rounded-md transition text-xs mb-1 ${
                      isSelected ? "bg-cyan-500/15 border border-cyan-400/40" : "hover:bg-cyan-500/10"
                    }`}
                    onClick={() => focusSatellite(satMeta.current.get(sat.mesh) ?? sat)}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium truncate max-w-[160px]">
                        {sat.name}
                      </span>
                      <span className="text-[10px] text-cyan-300/60">
                        NORAD {sat.noradId}
                      </span>
                    </div>
                    <span className="text-cyan-300/70 ml-2">›</span>
                  </button>
                )
              })
            )}
          </ScrollArea>

          <div className="font-semibold text-sm mb-2 text-cyan-300 border-t border-white/10 pt-3">
            Favoriten
          </div>

          <ScrollArea className="h-[18vh]">
            {favorites.length === 0 ? (
              <div className="text-xs text-cyan-300/60 px-1 py-1">
                Noch keine Favoriten.
              </div>
            ) : (
              favorites.map(noradId => {
                const meta = [...satMeta.current.values()].find(m => m.noradId === noradId)
                if (!meta) return null

                return (
                  <div
                    key={noradId}
                    className="flex items-center justify-between px-2 py-1.5 rounded-md 
                      hover:bg-cyan-500/10 cursor-pointer text-xs transition"
                    onClick={() => focusFavorite(noradId)}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium truncate max-w-[140px]">
                        {meta.name}
                      </span>
                      <span className="text-[10px] text-cyan-300/60">
                        NORAD {noradId}
                      </span>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-cyan-300 hover:bg-cyan-500/10"
                      onClick={e => {
                        e.stopPropagation()
                        toggleFavorite(noradId)
                      }}
                    >
                      ✕
                    </Button>
                  </div>
                )
              })
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

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
  )
}
