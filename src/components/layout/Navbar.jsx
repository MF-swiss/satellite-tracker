import { useLocation } from "react-router-dom"

export function Navbar() {
  const location = useLocation()

  const isActive = (path) =>
    location.pathname === path
      ? "text-cyan-300 font-semibold"
      : "text-cyan-300/60 hover:text-cyan-300 transition"

  return (
    <header
      className="
        cyber-navbar
        w-full h-16 flex items-center px-6
        border-b border-[var(--cyber-border)]
        shadow-[var(--cyber-glow)]
        backdrop-blur-xl
        bg-[var(--cyber-panel)]
        text-[var(--cyber-text)]
      "
    >
      {/* LEFT: LOGO + TITLE */}
      <div className="flex items-center gap-3">
        <div className="text-cyan-300 text-2xl">🛰️</div>
        <div className="cyber-title text-lg tracking-widest">
          SATELLITE TRACKER
        </div>
      </div>

      {/* CENTER: NAVIGATION */}
      <nav className="ml-16 flex items-center gap-10 text-sm">
        <a href="/" className={`flex items-center gap-1 ${isActive("/")}`}>
          🌍 <span>Globe</span>
        </a>

        <a
          href="/favorites"
          className={`flex items-center gap-1 ${isActive("/favorites")}`}
        >
          ⭐ <span>Favoriten</span>
        </a>

        <a
          href="/settings"
          className={`flex items-center gap-1 ${isActive("/settings")}`}
        >
          ⚙️ <span>Einstellungen</span>
        </a>
      </nav>

      {/* RIGHT: STATUS + COMMANDS */}
      <div className="ml-auto flex items-center gap-6">

        {/* LIVE STATUS INDICATOR */}
        <div className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full bg-cyan-300 animate-pulse"></div>
          <span className="text-cyan-300/80">Tracking Online</span>
        </div>

        {/* COMMAND BUTTONS */}
        <button
          className="
            cyber-button px-3 py-1 rounded-md text-xs
            hover:shadow-[0_0_10px_rgba(0,255,255,0.4)]
          "
        >
          Refresh TLE
        </button>

        <button
          className="
            cyber-button px-3 py-1 rounded-md text-xs
            hover:shadow-[0_0_10px_rgba(0,255,255,0.4)]
          "
        >
          System Log
        </button>
      </div>
    </header>
  )
}
