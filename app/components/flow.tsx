"use client"

import type React from "react"
import { useAccount, useReadContract, useSwitchChain } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, Loader2 } from "lucide-react"
import { ACTIVE_CHAIN_ID, Community } from "@/lib/chains"
import { contract } from "@/lib/contracts"
import { COMMUNITY_LABEL } from "@/lib/format"

/** Page-level heading block used by every flow page for a consistent look. */
export function FlowHeader({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="mx-auto max-w-3xl space-y-3 text-center">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      <p className="text-muted-foreground md:text-lg">{blurb}</p>
    </div>
  )
}

/** Wraps flow content, showing a connect / wrong-network gate until ready. */
export function ConnectGate({ children }: { children: React.ReactNode }) {
  const { isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  if (!isConnected) {
    return (
      <Card className="mx-auto mt-8 max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-muted-foreground">Connect a wallet to use this flow.</p>
          <ConnectButton />
        </CardContent>
      </Card>
    )
  }
  if (chainId !== ACTIVE_CHAIN_ID) {
    return (
      <Card className="mx-auto mt-8 max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <p className="text-muted-foreground">This demo runs on Gnosis Chain.</p>
          <Button onClick={() => switchChain({ chainId: ACTIVE_CHAIN_ID })}>
            Switch to Gnosis
          </Button>
        </CardContent>
      </Card>
    )
  }
  return <>{children}</>
}

/** Membership state for the connected wallet, refetched on demand. */
export function useMembership() {
  const { address } = useAccount()
  const active = useReadContract({
    ...contract.identity(),
    functionName: "isActiveMember",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })
  const community = useReadContract({
    ...contract.identity(),
    functionName: "communityOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })
  const c = Number(community.data ?? 0) as Community
  return {
    address,
    isActiveMember: Boolean(active.data),
    community: c,
    communityLabel: COMMUNITY_LABEL[c],
    refetch: () => {
      active.refetch()
      community.refetch()
    },
  }
}

/** A pending-aware primary action button. */
export function TxButton({
  pending,
  children,
  ...rest
}: React.ComponentProps<typeof Button> & { pending?: boolean }) {
  return (
    <Button {...rest} disabled={rest.disabled || pending}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  )
}
