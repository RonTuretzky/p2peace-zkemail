"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { OliveBranchIcon } from "@/components/olive-branch-icon"
import { cn } from "@/lib/utils"

// Four doors, no more: the story (home), doing it live, everything else in
// chronological order under /tools, and the technical docs.
const NAV = [
  { href: "/verify", label: "Try it live" },
  { href: "/tools", label: "Tools" },
  { href: "https://github.com/RonTuretzky/p2peace-zkemail/blob/master/docs/GET-STARTED.md", label: "Guide" },
  { href: "/docs", label: "Docs" },
]

export function SiteHeader() {
  const pathname = usePathname()
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/90 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-display font-bold">
          <OliveBranchIcon className="h-6 w-6 text-primary" />
          <span>p2p2p</span>
          <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
            on zkEmail
          </span>
        </Link>
        <nav className="hidden items-center gap-6 sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                pathname?.startsWith(item.href) ? "text-primary" : "text-muted-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
      </div>
    </header>
  )
}
