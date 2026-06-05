import { Navbar } from "./Navbar"

export function AppLayout({ children }) {
  return (
    <div className="w-full h-full flex flex-col bg-[var(--cyber-bg)] text-[var(--cyber-text)] overflow-hidden">

      {/* TOP NAVBAR */}
      <Navbar />

      {/* MAIN AREA */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* PAGE CONTENT */}
        <main className="flex-1 min-w-0 relative overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
