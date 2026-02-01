"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const WalletMultiButton = dynamic(
    () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
    { ssr: false }
);

export default function Header() {
    return (
        <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
            <div className="flex items-center gap-4">
                <Link href="/" className="text-xl font-bold text-amber-200">
                    Dark Pool
                </Link>
            </div>
            <div className="flex items-center gap-4">
                <WalletMultiButton style={{ backgroundColor: '#27272a', height: '40px' }} />
            </div>
        </header>
    );
}
