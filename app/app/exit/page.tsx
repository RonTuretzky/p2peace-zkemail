import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ConnectGate } from "@/components/flow"
import { ExitIndex } from "@/components/exit-index"

export default function ExitPage() {
  return (
    <div className="container mx-auto px-4 py-14">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          The shekel exit
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground md:text-lg">
          The honest version of &ldquo;devaluing the shekel&rdquo;: you can&apos;t sell a
          currency down, but you can shrink the demand that gives it value. Here is that demand
          leaving the shekel, one join at a time — read live from the chain.
        </p>
      </div>
      <ConnectGate>
        <ExitIndex />
      </ConnectGate>
      <div className="mx-auto mt-6 max-w-3xl text-center">
        <Button variant="outline" asChild>
          <a
            href="https://github.com/RonTuretzky/p2peace-zkemail/blob/master/docs/CURRENCY-MECHANISM.md"
            target="_blank"
            rel="noreferrer"
          >
            Read the full research: ILS stablecoins & why a sell mechanism isn&apos;t real
          </a>
        </Button>
      </div>
    </div>
  )
}
