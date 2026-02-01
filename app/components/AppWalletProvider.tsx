"use client";

import React, { useMemo } from "react";
import {
    ConnectionProvider,
    WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import "@solana/wallet-adapter-react-ui/styles.css";

export default function AppWalletProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const network = WalletAdapterNetwork.Devnet;
    // Public RPCs can be rate-limited. If you get 403/429 errors, try a custom RPC (e.g., Helius, QuickNode).
    const endpoint = useMemo(() => {
        const envUrl = process.env.NEXT_PUBLIC_RPC_URL?.trim();
        return envUrl && envUrl.length > 0 ? envUrl : clusterApiUrl(network);
    }, [network]);
    const wallets = useMemo(
        () => [
            // Add any specific wallets here if needed, otherwise standard support is included
        ],
        [network],
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
}
