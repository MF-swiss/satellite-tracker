import { ScrollArea } from "@/components/ui/scroll-area"

export function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-64 h-full 
      bg-[var(--cyber-panel)] border-r border-[var(--cyber-border)]
      backdrop-blur-xl shadow-[var(--cyber-glow)] text-[var(--cyber-text)]">

      <div className="p-4 font-semibold tracking-wide text-cyan-300">
        🛰️ SAT‑TRACKER
      </div>

      <nav className="flex flex-col gap-2 px-4 text-sm">
        <a className="hover:text-cyan-300 transition">🌍 Globe</a>
        <a className="hover:text-cyan-300 transition">⭐ Favoriten</a>
        <a className="hover:text-cyan-300 transition">⚙️ Einstellungen</a>
      </nav>
    </aside>
  )
}
