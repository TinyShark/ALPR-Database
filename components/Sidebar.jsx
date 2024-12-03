'use client'

import { useRouter, usePathname } from 'next/navigation'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ThemeToggle"
import { LayoutDashboard, Database, Settings } from 'lucide-react'
import { BookMarked } from 'lucide-react'
import { Cctv } from 'lucide-react'
import { Flag } from 'lucide-react'
import { BellPlus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { withBasePath } from "@/lib/utils"

const topSidebarItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Cctv, label: 'Live Feed', href: '/live_feed' },
  { icon: Database, label: 'Database', href: '/database' },
  { icon: BookMarked, label: 'Known Plates', href: '/known_plates' },
  { icon: Flag, label: 'Watchlist', href: '/flagged' },
  { icon: BellPlus, label: 'Notifications', href: '/notifications' },
]

export function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <TooltipProvider>
      <aside className="flex flex-col justify-between h-screen bg-background border-r w-14">
        <nav className="flex flex-col items-center pt-4 space-y-2">
          {topSidebarItems.map((item) => (
            <Tooltip key={item.href} delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  onClick={() => router.push(withBasePath(item.href))}
                  className={cn(
                    "w-10 h-10 p-0 hover:bg-transparent [&:not(:disabled)]:hover:bg-transparent",
                    pathname === item.href ? "text-blue-500" : "hover:text-blue-500"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="border-0 bg-muted">
                {item.label}
              </TooltipContent>
            </Tooltip>
          ))}
        </nav>
        <div className="flex flex-col items-center pb-4 space-y-2">
          <ThemeToggle />
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={() => router.push(withBasePath('/settings'))}
                className={cn(
                  "w-10 h-10 p-0 hover:bg-transparent [&:not(:disabled)]:hover:bg-transparent",
                  pathname === '/settings' ? "text-blue-500" : "hover:text-blue-500"
                )}
              >
                <Settings className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="border-0 bg-muted">
              Settings
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  )
}