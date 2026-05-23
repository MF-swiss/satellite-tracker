import { useEffect, useRef, useState } from "react";
import Globe from "globe.gl";
import * as THREE from "three";
import * as satellite from "satellite.js";
import { Card } from "./components/ui/card"; 
import { Button } from "./components/ui/button";
import { ScrollArea } from "./components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "./components/ui/sheet";


export default function GlobePage() {
  const ref = useRef();

  const [selectedSat, setSelectedSat] = useState(null);
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem("favorites");
    return saved ? JSON.parse(saved) : [];
  });

  const followSatRef = useRef(null);
  const satMeta = useRef(new Map()); // Mesh -> Meta

  useEffect(() => {
    const globe = Globe()(ref.current)
      .globeImageUrl("//unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
      .backgroundImageUrl("//unpkg.com/three-globe/example/img/night-sky.png");

    const scene = globe.scene();
    const camera = globe.camera();
    const renderer = globe.renderer();
    const R = globe.getGlobeRadius();

    const orbitGroup = new THREE.Group();
    const satGroup = new THREE.Group();
    scene.add(orbitGroup);
    scene.add(satGroup);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function animateCameraTo(targetPos) {
      const start = camera.position.clone();
      const end = targetPos.clone().multiplyScalar(1.8);

      let t = 0;
      const step = 0.08;

      function animate() {
        t += step;
        if (t >= 1) {
          camera.position.copy(end);
          camera.lookAt(0, 0, 0);
          return;
        }
        camera.position.lerpVectors(start, end, t);
        camera.lookAt(0, 0, 0);
        requestAnimationFrame(animate);
      }

      animate();
    }

    fetch("https://api.spacexdata.com/v4/starlink")
      .then(res => res.json())
      .then(data => {
        const sats = data.filter(s => s.spaceTrack?.TLE_LINE1 && s.spaceTrack?.TLE_LINE2);
        console.log("Starlinks geladen:", sats.length);

        sats.forEach(sat => {
          try {
            const tle1 = sat.spaceTrack.TLE_LINE1;
            const tle2 = sat.spaceTrack.TLE_LINE2;
            const satrec = satellite.twoline2satrec(tle1, tle2);

            // Orbit
            const points = [];
            const now = new Date();
            for (let m = -45; m <= 45; m += 3) {
              const time = new Date(now.getTime() + m * 60000);
              const gmst = satellite.gstime(time);
              const pv = satellite.propagate(satrec, time);
              if (!pv.position) continue;

              const gd = satellite.eciToGeodetic(pv.position, gmst);
              const lat = satellite.radiansToDegrees(gd.latitude);
              const lng = satellite.radiansToDegrees(gd.longitude);
              const alt = Math.max(0.01, gd.height / 6371);

              const phi = (90 - lat) * Math.PI / 180;
              const theta = (lng + 180) * Math.PI / 180;
              const r = R * (1 + alt);

              points.push(
                new THREE.Vector3(
                  r * Math.sin(phi) * Math.cos(theta),
                  r * Math.cos(phi),
                  r * Math.sin(phi) * Math.sin(theta)
                )
              );
            }

            if (points.length < 2) return;

            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ color: "cyan" });
            orbitGroup.add(new THREE.Line(geometry, material));

            // Satellitenpunkt
            const norad = sat.spaceTrack.OBJECT_NUMBER;
            const isFav = favorites.includes(norad);

            const satMesh = new THREE.Mesh(
              new THREE.SphereGeometry(0.01 * R, 8, 8),
              new THREE.MeshBasicMaterial({ color: isFav ? "orange" : "yellow" })
            );
            satGroup.add(satMesh);

            satMeta.current.set(satMesh, {
              name: sat.spaceTrack.OBJECT_NAME,
              noradId: norad,
              tle1,
              tle2,
              mesh: satMesh
            });

            function updateSat() {
              const time = new Date();
              const gmst = satellite.gstime(time);
              const pv = satellite.propagate(satrec, time);
              if (!pv.position) return;

              const gd = satellite.eciToGeodetic(pv.position, gmst);
              const lat = satellite.radiansToDegrees(gd.latitude);
              const lng = satellite.radiansToDegrees(gd.longitude);
              const alt = Math.max(0.01, gd.height / 6371);

              const phi = (90 - lat) * Math.PI / 180;
              const theta = (lng + 180) * Math.PI / 180;
              const r = R * (1 + alt);

              satMesh.position.set(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.cos(phi),
                r * Math.sin(phi) * Math.sin(theta)
              );

              if (followSatRef.current === satMesh) {
                animateCameraTo(satMesh.position);
              }
            }

            updateSat();
            setInterval(updateSat, 1000);
          } catch (err) {
            console.warn("Fehler bei Satellit:", err);
          }
        });
      });

    function onClick(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(satGroup.children, true);

      if (intersects.length > 0) {
        const mesh = intersects[0].object;
        const meta = satMeta.current.get(mesh);
        if (meta) {
          setSelectedSat(meta);
          followSatRef.current = mesh;
        }
      } else {
        setSelectedSat(null);
        followSatRef.current = null;
      }
    }

    renderer.domElement.addEventListener("pointerdown", onClick);
    return () => {
      renderer.domElement.removeEventListener("pointerdown", onClick);
    };
  }, []); // ← NICHT favorites rein!

  function toggleFavorite(noradId) {
    let updated;
    if (favorites.includes(noradId)) {
      updated = favorites.filter(id => id !== noradId);
    } else {
      updated = [...favorites, noradId];
    }
    setFavorites(updated);
    localStorage.setItem("favorites", JSON.stringify(updated));

    // Farbe live ändern
    for (const meta of satMeta.current.values()) {
      if (meta.noradId === noradId) {
        meta.mesh.material.color.set(updated.includes(noradId) ? "orange" : "yellow");
      }
    }
  }

  function focusFavorite(noradId) {
    for (const meta of satMeta.current.values()) {
      if (meta.noradId === noradId) {
        followSatRef.current = meta.mesh;
        setSelectedSat(meta);
      }
    }
  }

  return (
  <div className="relative w-full h-full overflow-hidden">

    {/* Globe Canvas */}
    <div
      ref={ref}
      className="absolute inset-0 z-0"
    />

    {/* Favoriten-Sidebar (Desktop) */}
    <Card className="hidden lg:flex flex-col gap-2 absolute left-4 top-4 w-64 max-h-[80vh] bg-background/80 backdrop-blur border border-border z-20">
      <div className="px-3 pt-3 pb-1 font-semibold text-sm flex items-center gap-2">
        <span>⭐ Favoriten</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {favorites.length} ausgewählt
        </span>
      </div>

      <ScrollArea className="px-2 pb-3">
        {favorites.length === 0 && (
          <div className="text-xs text-muted-foreground px-2 py-1">
            Noch keine Favoriten. Wähle einen Satelliten im Popup.
          </div>
        )}

        {favorites.map(noradId => {
          const meta = [...satMeta.current.values()].find(m => m.noradId === noradId)
          if (!meta) return null

          return (
            <div
              key={noradId}
              className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-xs"
              onClick={() => focusFavorite(noradId)}
            >
              <div className="flex flex-col">
                <span className="font-medium truncate max-w-[140px]">
                  {meta.name}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  NORAD {noradId}
                </span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-amber-400"
                onClick={e => {
                  e.stopPropagation()
                  toggleFavorite(noradId)
                }}
              >
                ✕
              </Button>
            </div>
          )
        })}
      </ScrollArea>
    </Card>

    {/* Favoriten-Sidebar (Mobile) */}
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="lg:hidden absolute left-4 top-4 z-30 bg-background/80 backdrop-blur"
        >
          ⭐ Favoriten
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-64 p-3">
        <div className="font-semibold text-sm mb-2">Favoriten</div>

        <ScrollArea className="h-[70vh]">
          {favorites.length === 0 && (
            <div className="text-xs text-muted-foreground px-1 py-1">
              Noch keine Favoriten.
            </div>
          )}

          {favorites.map(noradId => {
            const meta = [...satMeta.current.values()].find(m => m.noradId === noradId)
            if (!meta) return null

            return (
              <div
                key={noradId}
                className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-xs"
                onClick={() => focusFavorite(noradId)}
              >
                <div className="flex flex-col">
                  <span className="font-medium truncate max-w-[140px]">
                    {meta.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    NORAD {noradId}
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-amber-400"
                  onClick={e => {
                    e.stopPropagation()
                    toggleFavorite(noradId)
                  }}
                >
                  ✕
                </Button>
              </div>
            )
          })}
        </ScrollArea>
      </SheetContent>
    </Sheet>

    {/* Popup rechts */}
    {selectedSat && (
      <Card className="absolute right-4 top-4 max-w-xs bg-background/85 backdrop-blur border border-border text-sm z-20">
        <div className="px-3 pt-3 pb-1">
          <div className="font-semibold text-sm truncate">
            {selectedSat.name}
          </div>
          <div className="text-xs text-muted-foreground">
            NORAD ID: {selectedSat.noradId}
          </div>
        </div>

        <div className="px-3 pb-2 flex gap-2">
          <Button
            size="sm"
            className="text-xs"
            variant={favorites.includes(selectedSat.noradId) ? "default" : "outline"}
            onClick={() => toggleFavorite(selectedSat.noradId)}
          >
            {favorites.includes(selectedSat.noradId) ? "★ Favorit" : "☆ Favorit"}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="text-xs ml-auto"
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