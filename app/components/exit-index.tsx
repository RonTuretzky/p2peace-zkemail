"use client"

import { useEffect, useState } from "react"
import { useReadContracts } from "wagmi"
import { formatUnits } from "viem"
import { TrendDown, ArrowUp } from "@phosphor-icons/react"
import { SectionHeading, HonestyNote, StatPill } from "@/components/explainer"
import { contract } from "@/lib/contracts"
import { ADDRESSES } from "@/lib/chains"

const ZERO = "0x0000000000000000000000000000000000000000" as const

/**
 * ExitIndex — the honest, measurable "shekel-devaluation" mechanism.
 *
 * There is no way to sell a national currency down (a backed stablecoin is
 * un-sellable-down, and the real FX market is far too deep — see
 * docs/CURRENCY-MECHANISM.md). What a protocol *can* do is shrink demand for the
 * currency by giving people a better place to keep their economic life. This
 * panel measures exactly that: every unit of sDAI locked inside p2peace is value
 * that has left national-currency demand for money two communities govern
 * together. It reads straight from on-chain balances — no new token, no trust,
 * no manipulation.
 */
export function ExitIndex() {
  const reads = useReadContracts({
    contracts: [
      { ...contract.reserve(), functionName: "balanceOf", args: [ADDRESSES.peaceMinterA] },
      { ...contract.reserve(), functionName: "balanceOf", args: [ADDRESSES.peaceMinterB] },
      { ...contract.reserve(), functionName: "balanceOf", args: [ADDRESSES.treasury] },
      { ...contract.reserve(), functionName: "balanceOf", args: [ADDRESSES.sanctionsEscrow] },
      { ...contract.tokenA(), functionName: "totalSupply", args: [] },
      { ...contract.tokenB(), functionName: "totalSupply", args: [] },
      { ...contract.reserve(), functionName: "balanceOf", args: [ADDRESSES.exitAssurance] },
      { ...contract.exitAssurance(), functionName: "attestedExits", args: [] },
    ],
  })

  const r = (i: number) => (reads.data?.[i]?.result as bigint) ?? 0n
  const reserveA = r(0)
  const reserveB = r(1)
  const treasury = r(2)
  const escrow = r(3)
  const supplyA = r(4)
  const supplyB = r(5)
  const voluntaryExit = r(6) // sDAI locked in ExitAssurance (the /exit console)
  const attestedExits = r(7) // members with a DKIM provenance receipt attached
  const totalLocked = reserveA + reserveB + treasury + escrow + voluntaryExit // sDAI, 18 dec
  const lockedNum = Number(formatUnits(totalLocked, 18))

  // Off-chain ILS/USD rate (there is NO trustworthy on-chain ILS feed — see doc).
  // Presentational only, clearly labelled. Falls back to a recent approximate.
  const [ilsPerUsd, setIlsPerUsd] = useState<number>(3.7)
  const [rateLive, setRateLive] = useState(false)
  useEffect(() => {
    const ctrl = new AbortController()
    fetch("https://open.er-api.com/v6/latest/USD", { signal: ctrl.signal })
      .then((res) => res.json())
      .then((j) => {
        const v = j?.rates?.ILS
        if (typeof v === "number" && v > 0) {
          setIlsPerUsd(v)
          setRateLive(true)
        }
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  const shekels = lockedNum * ilsPerUsd
  const fmtMoney = (n: number, symbol: string) =>
    `${symbol}${n.toLocaleString(undefined, { maximumFractionDigits: n < 100 ? 2 : 0 })}`

  return (
    <section className="w-full py-14">
      <div className="container mx-auto px-4">
        <SectionHeading
          chip="The shekel exit, measured"
          title="Value that has left national-currency demand"
          lede="You can't sell a currency down — but you can shrink the demand that gives it value. This is the running total of economic life now denominated outside the shekel, read live from the chain."
        />

        <div className="mx-auto mt-10 max-w-3xl">
          <div className="rounded-3xl border-2 border-primary/40 bg-card p-8 text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground">
              <TrendDown className="h-4 w-4 text-primary" weight="bold" />
              Withdrawn from national-currency demand
            </div>
            <div className="mt-2 font-display text-5xl font-bold text-primary">
              {fmtMoney(lockedNum, "$")}
              <span className="text-2xl text-muted-foreground"> in sDAI</span>
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              ≈ {fmtMoney(shekels, "₪")}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                at {ilsPerUsd.toFixed(2)} ₪/$ {rateLive ? "(live)" : "(approx.)"}
              </span>
            </div>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              Every join adds to this; every redemption subtracts. It is demand for the shekel
              that no longer exists — and monetary control the state no longer has.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatPill
              label="Voluntary exits"
              value={fmtMoney(Number(formatUnits(voluntaryExit, 18)), "$")}
              hint="sDAI members locked in the /exit console — the deliberate exit"
            />
            <StatPill
              label="Backing community money"
              value={fmtMoney(Number(formatUnits(reserveA + reserveB, 18)), "$")}
              hint="sDAI reserve behind PEACE-A + PEACE-B, fully redeemable"
            />
            <StatPill
              label="Shared Treasury"
              value={fmtMoney(Number(formatUnits(treasury, 18)), "$")}
              hint="outsider premiums + donations, funding peace rewards"
            />
            <StatPill
              label="Escrowed relief"
              value={fmtMoney(Number(formatUnits(escrow, 18)), "$")}
              hint="pre-committed sanctions relief awaiting verified events"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <ArrowUp className="h-3.5 w-3.5 text-primary" weight="bold" />
              {fmtMoney(Number(formatUnits(supplyA + supplyB, 18)), "")} units of community money in
              circulation, each 1:1 redeemable
            </span>
            <span>
              · {attestedExits.toString()} exit
              {attestedExits === 1n ? "" : "s"} with an attached shekel-provenance receipt
            </span>
          </div>
        </div>

        <HonestyNote>
          This is a <em>demand</em> figure, not a price move: the tools never hold or sell
          shekels (a fully-backed shekel stablecoin can&apos;t be sold down, and the real FX
          market is far too deep for any protocol to move — see{" "}
          <a
            className="underline"
            href="https://github.com/RonTuretzky/p2peace-zkemail/blob/master/docs/CURRENCY-MECHANISM.md"
            target="_blank"
            rel="noreferrer"
          >
            CURRENCY-MECHANISM.md
          </a>
          ). The ₪ figure uses an off-chain USD/ILS rate for legibility only; there is no
          trustworthy on-chain shekel price feed. The sDAI number is the one that is always
          exactly true.
        </HonestyNote>
      </div>
    </section>
  )
}
