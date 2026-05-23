import { ThemeToggle } from "./ThemeToggle"
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Sidebar } from "./Sidebar"

export function Navbar() {
  return (
    <header className="w-full h-14 border-b bg-background/80 backdrop-blur flex items-center px-4 justify-between">
      <div className="font-semibold text-lg">🛰️ Satellite Tracker</div>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="lg:hidden">
            ☰
          </Button>
        </SheetTrigger>

        <SheetContent side="left" className="w-64 p-4">
          <Sidebar mobile />
        </SheetContent>
      </Sheet>

      <ThemeToggle />
    </header>
  )
}
