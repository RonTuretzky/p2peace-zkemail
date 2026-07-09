import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-border py-8">
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 md:flex-row">
        <p className="text-sm text-muted-foreground">
          © 2026 p2p2p Initiative · verified with zkEmail · deployed on Gnosis Chain
        </p>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/docs" className="hover:text-primary">
            Docs
          </Link>
          <a
            href="https://github.com/RonTuretzky/p2peace-zkemail"
            target="_blank"
            rel="noreferrer"
            className="hover:text-primary"
          >
            GitHub
          </a>
          <span className="hidden md:inline">Branded with the Decentral Park UI kit</span>
        </nav>
      </div>
    </footer>
  )
}
