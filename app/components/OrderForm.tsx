"use client";

import { useState, useEffect } from "react";
import { useDarkPool } from "../hooks/useDarkPool";
import { Coins, Loader2, Lock } from "lucide-react";

export default function OrderForm() {
    const { placeOrder, delegateOrder } = useDarkPool();
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<string>("");

    const [side, setSide] = useState<"buy" | "sell">("buy");
    const [amount, setAmount] = useState<string>("");
    const [price, setPrice] = useState<string>("");
    const [orderId, setOrderId] = useState<string>("");

    useEffect(() => {
        setOrderId(Date.now().toString());
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setStatus("Placing order on-chain...");

        try {
            // 1. Place Order
            const { tx, orderPda } = await placeOrder(
                Number(orderId),
                side === "buy" ? { buy: {} } : { sell: {} },
                Number(amount),
                Number(price)
            );

            setStatus(`Order Placed! Tx: ${tx.slice(0, 8)}... Delegating to TEE...`);

            // 2. Delegate Order
            const delegateTx = await delegateOrder(orderPda, Number(orderId));

            setStatus(`Success! Order delegated. TEE Tx: ${delegateTx.slice(0, 8)}...`);
            setOrderId(Date.now().toString()); // Reset ID for next order

        } catch (error: any) {
            console.error(error);
            setStatus(`Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-4 p-1 bg-zinc-800 rounded-lg">
                <button
                    type="button"
                    onClick={() => setSide("buy")}
                    className={`flex-1 py-2 rounded-md font-semibold transition-all ${side === "buy"
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                        : "text-zinc-400 hover:text-white"
                        }`}
                >
                    Buy
                </button>
                <button
                    type="button"
                    onClick={() => setSide("sell")}
                    className={`flex-1 py-2 rounded-md font-semibold transition-all ${side === "sell"
                        ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                        : "text-zinc-400 hover:text-white"
                        }`}
                >
                    Sell
                </button>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Amount</label>
                <div className="relative">
                    <Coins className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                    <input
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full bg-zinc-800 border-none rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-purple-500 placeholder:text-zinc-600"
                        required
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Price</label>
                <div className="relative">
                    <span className="absolute left-4 top-2.5 text-zinc-500">$</span>
                    <input
                        type="number"
                        placeholder="0.00"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full bg-zinc-800 border-none rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-purple-500 placeholder:text-zinc-600"
                        required
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Order ID</label>
                <div className="relative">
                    <span className="absolute left-4 top-2.5 text-zinc-500">#</span>
                    <input
                        type="number"
                        value={orderId}
                        onChange={(e) => setOrderId(e.target.value)}
                        className="w-full bg-zinc-800 border-none rounded-lg py-2.5 pl-10 pr-4 text-zinc-400 focus:ring-2 focus:ring-purple-500"
                        readOnly
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {isLoading ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                    </>
                ) : (
                    <>
                        <Lock className="w-4 h-4" />
                        Place Private Order
                    </>
                )}
            </button>

            {status && (
                <div className={`p-3 rounded-lg text-sm ${status.includes("Error") ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"}`}>
                    {status}
                </div>
            )}
        </form>
    );
}
