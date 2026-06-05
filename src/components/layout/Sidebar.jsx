import { useMemo, useState } from "react"

import { Button } from "../ui/button"
import { ScrollArea } from "../ui/scroll-area"

export function Sidebar({
  satCatalog,
  selectedSat,
  favorites,
  onSelectSatellite,
  onToggleFavorite,
  onSelectFavorite,
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [sortMode, setSortMode] = useState("name")

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const visibleCatalog = useMemo(() => {
    const filtered = satCatalog.filter(sat => {
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

    const sorted = [...filtered].sort((a, b) => {
      if (sortMode === "norad") {
        return Number(a.noradId) - Number(b.noradId)
      }

      if (sortMode === "objectId") {
        return (a.objectId ?? "").localeCompare(b.objectId ?? "")
      }

      return (a.name ?? "").localeCompare(b.name ?? "")
    })

    return sorted
  }, [normalizedQuery, satCatalog, sortMode])

  return (
    <aside
      className="hidden lg:flex flex-col w-full min-w-0 h-full shrink-0 
      bg-[var(--cyber-panel)]/95 border-r border-[var(--cyber-border)]
      backdrop-blur-xl shadow-[var(--cyber-glow)] text-[var(--cyber-text)] z-20"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "clamp(260px, 20vw, 360px)",
        minWidth: 0,
        minHeight: 0,
        height: "100%",
        flexShrink: 0,
        position: "relative",
        zIndex: 2,
        overflow: "hidden",
        background: "rgba(10, 20, 30, 0.95)",
        borderRight: "1px solid rgba(0, 255, 255, 0.15)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 0 20px rgba(0, 255, 255, 0.15)",
        color: "#d7faff",
      }}
    >

      <div
        className="px-4 pt-4 pb-3 border-b border-white/10"
        style={{ flexShrink: 0 }}
      >
        <div className="font-semibold tracking-wide text-cyan-300 text-sm mb-3">
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

      <div
        className="px-4 pt-3 pb-2 text-xs text-cyan-300/70 flex items-center gap-2"
        style={{ flexShrink: 0 }}
      >
        <span>{visibleCatalog.length} Satelliten</span>
        {normalizedQuery && <span className="text-cyan-300/40">• gefiltert</span>}
      </div>

      <ScrollArea
        className="px-2 pb-3 flex-1"
        style={{ flex: "1 1 0%", minHeight: 0, overflow: "hidden" }}
      >
        {visibleCatalog.length === 0 ? (
          <div className="text-xs text-cyan-300/60 px-2 py-1">
            Keine Treffer.
          </div>
        ) : (
          visibleCatalog.slice(0, 200).map(sat => {
            const isSelected = selectedSat?.noradId === sat.noradId

            return (
              <div
                key={`${sat.noradId}-${sat.name}`}
                className={`w-full text-left flex items-center justify-between px-2 py-2 rounded-md transition text-xs mb-1 ${
                  isSelected ? "bg-cyan-500/15 border border-cyan-400/40" : "hover:bg-cyan-500/10"
                }`}
              >
                <button
                  className="flex-1 text-left min-w-0"
                  onClick={() => onSelectSatellite(sat)}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate max-w-[180px]">
                      {sat.name}
                    </span>
                    <span className="text-[10px] text-cyan-300/60">
                      NORAD {sat.noradId}
                    </span>
                  </div>
                </button>

                <div className="flex items-center gap-1 pl-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-cyan-300 hover:bg-cyan-500/10"
                    onClick={e => {
                      e.stopPropagation()
                      onToggleFavorite(sat.noradId)
                    }}
                  >
                    {favorites.includes(sat.noradId) ? "★" : "☆"}
                  </Button>

                  <span className="text-cyan-300/70">›</span>
                </div>
              </div>
            )
          })
        )}
      </ScrollArea>

      <div
        className="px-4 pt-2 pb-1 font-semibold tracking-wide text-cyan-300 text-sm border-t border-white/10"
        style={{ flexShrink: 0 }}
      >
        ⭐ Favoriten
      </div>

      <ScrollArea
        className="px-2 pb-3 max-h-52"
        style={{ flex: "0 0 auto", minHeight: 0, maxHeight: "13rem", overflow: "hidden" }}
      >
        {favorites.length === 0 && (
          <div className="text-xs text-cyan-300/60 px-2 py-1">
            Noch keine Favoriten.
          </div>
        )}

        {favorites.map(noradId => {
          const sat = satCatalog.find(item => item.noradId === noradId)
          if (!sat) return null

          return (
            <button
              key={`fav-${noradId}-${sat.name}`}
              className="w-full flex items-center justify-between px-2 py-2 rounded-md hover:bg-cyan-500/10 cursor-pointer text-xs transition mb-1"
              onClick={() => onSelectFavorite(noradId)}
            >
              <div className="flex flex-col min-w-0 text-left">
                <span className="font-medium truncate max-w-[180px]">
                  {sat.name}
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
                  onToggleFavorite(noradId)
                }}
              >
                ✕
              </Button>
            </button>
          )
        })}
      </ScrollArea>
    </aside>
  )
}
