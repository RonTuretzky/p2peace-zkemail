"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { WagmiProvider, createConfig, http } from "wagmi"
import { gnosis } from "wagmi/chains"
import { injected, walletConnect } from "wagmi/connectors"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RainbowKitProvider, connectorsForWallets } from "@rainbow-me/rainbowkit"
import {
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets"
import { ParkUIKitProvider } from "@decentralpark/ui"
import { ConnectedUserProvider } from "@decentralpark/ui"
import "@rainbow-me/rainbowkit/styles.css"
import { hydrateRemoteAddresses } from "@/lib/remote-addresses"
import { ADDRESSES, ACTIVE_CHAIN_ID } from "@/lib/chains"
import { abis } from "@/lib/contracts"

const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_ID || "p2peace-demo"

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [injectedWallet, metaMaskWallet, rainbowWallet, walletConnectWallet],
    },
  ],
  { appName: "p2peace", projectId: WC_PROJECT_ID },
)

const wagmiConfig = createConfig({
  chains: [gnosis],
  connectors,
  transports: {
    [gnosis.id]: http("https://rpc.gnosischain.com"),
  },
  ssr: false,
})

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  // Pull the latest published addresses (crowdstake convention) before first paint
  // of contract-bound UI; fail-soft to the baked-in fallbacks.
  const [, setHydrated] = useState(0)
  useEffect(() => {
    hydrateRemoteAddresses().then((changed) => changed && setHydrated((n) => n + 1))
  }, [])

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider modalSize="compact">
          <ParkUIKitProvider
            app="net"
            chainId={ACTIVE_CHAIN_ID}
            authProvider="general"
            tokenConfig={{ address: ADDRESSES.peaceTokenA, abi: abis.peaceToken as never }}
          >
            <ConnectedUserProvider>{children}</ConnectedUserProvider>
          </ParkUIKitProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
