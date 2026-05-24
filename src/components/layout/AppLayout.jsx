import { Navbar } from "./Navbar"
import { Sidebar } from "./Sidebar"

export function AppLayout({ children }) {
  return (
    <div className="w-full h-full flex flex-col bg-[var(--cyber-bg)] text-[var(--cyber-text)]">

      {/* TOP NAVBAR */}
      <Navbar />

      {/* MAIN AREA */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT SIDEBAR */}
        <Sidebar />

        {/* PAGE CONTENT */}
        <main className="flex-1 relative overflow-hidden">
          {children}
        </main>

      </div>
    </div>
  )
}
