import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { Network } from "@aptos-labs/ts-sdk";
import type { ReactNode } from "react";

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <AptosWalletAdapterProvider
      autoConnect
      dappConfig={{
        network: Network.TESTNET,
      }}
      onError={(err) => console.error("Wallet error:", err)}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}
