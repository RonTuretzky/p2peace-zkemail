import type React from "react"
import type { Metadata } from "next"
import "@/app/globals.css"
import { Providers } from "@/components/providers"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export const metadata: Metadata = {
  title: "p2p2p — Building Peace Through Economic Interdependence",
  description:
    "peer to peer to peace: a decentralized protocol letting citizens of conflicting nations build economic cooperation, verified with zkEmail. Branded with the Decentral Park UI kit.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  )
}
