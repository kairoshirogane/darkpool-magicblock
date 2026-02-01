"use client";

import { useState, useEffect } from "react";
import { useDarkPool } from "../hooks/useDarkPool";
import { Coins, Loader2, Lock } from "lucide-react";
import { PublicKey } from "@solana/web3.js";

export default function OrderForm() {
    const {
        placeOrder,
        delegateOrder,
        initializeOrderbook,
        cancelOrder,
        pauseMarket,
        resumeMarket,
        matchOrders,
    } = useDarkPool();
    const [isLoading, setIsLoading] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [status, setStatus] = useState<string>("");

    const [side, setSide] = useState<"buy" | "sell">("buy");
    const [amount, setAmount] = useState<string>("");
    const [price, setPrice] = useState<string>("");
    const [orderId, setOrderId] = useState<string>("");
    const [marketAddress, setMarketAddress] = useState<string>("11111111111111111111111111111111");
    const [validUntil, setValidUntil] = useState<string>("");
    const [commitFreqMs, setCommitFreqMs] = useState<string>("1000");
    const [cancelOrderId, setCancelOrderId] = useState<string>("");
    const [tradeId, setTradeId] = useState<string>("");
    const [buyOrderAddress, setBuyOrderAddress] = useState<string>("");
    const [sellOrderAddress, setSellOrderAddress] = useState<string>("");
    const [isMatching, setIsMatching] = useState(false);
    const [isPausing, setIsPausing] = useState(false);
    const [isResuming, setIsResuming] = useState(false);

    useEffect(() => {
        setOrderId(Date.now().toString());
        setValidUntil(Math.floor(Date.now() / 1000 + 3600).toString());
    }, []);

    const parseMarketKey = () => {
        try {
            return new PublicKey(marketAddress.trim());
        } catch {
            setStatus("Error: Invalid market address.");
            return null;
        }
    };

    const parsePublicKey = (value: string, label: string) => {
        try {
            return new PublicKey(value.trim());
        } catch {
            setStatus(`Error: Invalid ${label} address.`);
            return null;
        }
    };

    const parsePositiveNumber = (value: string) => {
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) return null;
        return n;
    };

    const parsePositiveInteger = (value: string) => {
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
        return n;
    };

    const handleInitializeOrderbook = async () => {
        const marketKey = parseMarketKey();
        if (!marketKey) return;

        setIsInitializing(true);
        setStatus("Initializing orderbook...");

        try {
            const { tx } = await initializeOrderbook(marketKey);
            setStatus(`Orderbook initialized. Tx: ${tx.slice(0, 8)}...`);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            setStatus(`Error: ${message}`);
        } finally {
            setIsInitializing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const marketKey = parseMarketKey();
        if (!marketKey) return;

        const parsedOrderId = parsePositiveInteger(orderId);
        if (!parsedOrderId) {
            setStatus("Error: Order ID must be a positive integer.");
            return;
        }

        const parsedAmount = parsePositiveNumber(amount);
        if (!parsedAmount) {
            setStatus("Error: Amount must be greater than zero.");
            return;
        }

        const parsedPrice = parsePositiveNumber(price);
        if (!parsedPrice) {
            setStatus("Error: Price must be greater than zero.");
            return;
        }

        const parsedValidUntil = parsePositiveInteger(validUntil);
        if (!parsedValidUntil) {
            setStatus("Error: Valid until must be a positive unix timestamp.");
            return;
        }

        const parsedCommitFreqMs = parsePositiveInteger(commitFreqMs);
        if (!parsedCommitFreqMs) {
            setStatus("Error: Commit frequency must be a positive integer in milliseconds.");
            return;
        }

        setIsLoading(true);
        setStatus("Placing order on-chain...");

        try {
            // 1. Place Order
            const { tx, orderPda } = await placeOrder(
                parsedOrderId,
                side === "buy" ? { buy: {} } : { sell: {} },
                parsedAmount,
                parsedPrice,
                marketKey
            );

            setStatus(`Order Placed! Tx: ${tx.slice(0, 8)}... Delegating to TEE...`);

            // 2. Delegate Order
            const delegateTx = await delegateOrder(orderPda, parsedOrderId, parsedValidUntil, parsedCommitFreqMs);

            setStatus(`Success! Order delegated. TEE Tx: ${delegateTx.slice(0, 8)}...`);
            setOrderId(Date.now().toString()); // Reset ID for next order

        } catch (error: any) {
            const message = error instanceof Error ? error.message : "Unknown error";
            setStatus(`Error: ${message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancelOrder = async () => {
        const parsedCancelId = parsePositiveInteger(cancelOrderId);
        if (!parsedCancelId) {
            setStatus("Error: Cancel Order ID must be a positive integer.");
            return;
        }

        setIsCancelling(true);
        setStatus("Cancelling order...");

        try {
            const tx = await cancelOrder(parsedCancelId);
            setStatus(`Order cancelled. Tx: ${tx.slice(0, 8)}...`);
            setCancelOrderId("");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            setStatus(`Error: ${message}`);
        } finally {
            setIsCancelling(false);
        }
    };

    const handlePauseMarket = async () => {
        const marketKey = parseMarketKey();
        if (!marketKey) return;

        setIsPausing(true);
        setStatus("Pausing market...");

        try {
            const tx = await pauseMarket(marketKey);
            setStatus(`Market paused. Tx: ${tx.slice(0, 8)}...`);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            setStatus(`Error: ${message}`);
        } finally {
            setIsPausing(false);
        }
    };

    const handleResumeMarket = async () => {
        const marketKey = parseMarketKey();
        if (!marketKey) return;

        setIsResuming(true);
        setStatus("Resuming market...");

        try {
            const tx = await resumeMarket(marketKey);
            setStatus(`Market resumed. Tx: ${tx.slice(0, 8)}...`);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            setStatus(`Error: ${message}`);
        } finally {
            setIsResuming(false);
        }
    };

    const handleMatchOrders = async () => {
        const marketKey = parseMarketKey();
        if (!marketKey) return;

        const parsedTradeId = parsePositiveInteger(tradeId);
        if (!parsedTradeId) {
            setStatus("Error: Trade ID must be a positive integer.");
            return;
        }

        const buyKey = parsePublicKey(buyOrderAddress, "buy order");
        if (!buyKey) return;

        const sellKey = parsePublicKey(sellOrderAddress, "sell order");
        if (!sellKey) return;

        setIsMatching(true);
        setStatus("Matching orders...");

        try {
            const tx = await matchOrders(marketKey, parsedTradeId, buyKey, sellKey);
            setStatus(`Trade executed. Tx: ${tx.slice(0, 8)}...`);
            setTradeId("");
            setBuyOrderAddress("");
            setSellOrderAddress("");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            setStatus(`Error: ${message}`);
        } finally {
            setIsMatching(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <label htmlFor="market" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Market Address</label>
                <div className="relative">
                    <input
                        id="market"
                        type="text"
                        placeholder="Market public key"
                        value={marketAddress}
                        onChange={(e) => setMarketAddress(e.target.value)}
                        className="w-full bg-zinc-800 border-none rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-amber-500 placeholder:text-zinc-600"
                        required
                    />
                </div>
                <button
                    type="button"
                    onClick={handleInitializeOrderbook}
                    disabled={isInitializing || isLoading || isCancelling || isMatching || isPausing || isResuming}
                    className="w-full py-2.5 bg-zinc-100 text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isInitializing ? "Initializing..." : "Initialize Orderbook"}
                </button>
            </div>

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
                <label htmlFor="amount" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Amount</label>
                <div className="relative">
                    <Coins className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                    <input
                        id="amount"
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full bg-zinc-800 border-none rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-emerald-500 placeholder:text-zinc-600"
                        required
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label htmlFor="price" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Price</label>
                <div className="relative">
                    <span className="absolute left-4 top-2.5 text-zinc-500">$</span>
                    <input
                        id="price"
                        type="number"
                        placeholder="0.00"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full bg-zinc-800 border-none rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-emerald-500 placeholder:text-zinc-600"
                        required
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label htmlFor="orderId" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Order ID</label>
                <div className="relative">
                    <span className="absolute left-4 top-2.5 text-zinc-500">#</span>
                    <input
                        id="orderId"
                        type="number"
                        value={orderId}
                        onChange={(e) => setOrderId(e.target.value)}
                        className="w-full bg-zinc-800 border-none rounded-lg py-2.5 pl-10 pr-4 text-zinc-400 focus:ring-2 focus:ring-emerald-500"
                        readOnly
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <label htmlFor="validUntil" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Valid Until (Unix Seconds)</label>
                    <input
                        id="validUntil"
                        type="number"
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                        className="w-full bg-zinc-800 border-none rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-emerald-500 placeholder:text-zinc-600"
                        required
                    />
                </div>
                <div className="space-y-2">
                    <label htmlFor="commitFreqMs" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Commit Frequency (ms)</label>
                    <input
                        id="commitFreqMs"
                        type="number"
                        value={commitFreqMs}
                        onChange={(e) => setCommitFreqMs(e.target.value)}
                        className="w-full bg-zinc-800 border-none rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-emerald-500 placeholder:text-zinc-600"
                        required
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={isLoading || isInitializing || isCancelling || isMatching || isPausing || isResuming}
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

            <div className="space-y-2">
                <label htmlFor="cancelOrderId" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Cancel Order ID</label>
                <input
                    id="cancelOrderId"
                    type="number"
                    placeholder="Order ID"
                    value={cancelOrderId}
                    onChange={(e) => setCancelOrderId(e.target.value)}
                    className="w-full bg-zinc-800 border-none rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-rose-500 placeholder:text-zinc-600"
                />
                <button
                    type="button"
                    onClick={handleCancelOrder}
                    disabled={isCancelling || isLoading || isInitializing || isMatching || isPausing || isResuming}
                    className="w-full py-2.5 bg-rose-500 text-white font-semibold rounded-lg hover:bg-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isCancelling ? "Cancelling..." : "Cancel Order"}
                </button>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Market Controls</span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <button
                        type="button"
                        onClick={handlePauseMarket}
                        disabled={isPausing || isLoading || isInitializing || isCancelling || isMatching || isResuming}
                        className="w-full py-2.5 bg-zinc-800 text-zinc-100 font-semibold rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isPausing ? "Pausing..." : "Pause Market"}
                    </button>
                    <button
                        type="button"
                        onClick={handleResumeMarket}
                        disabled={isResuming || isLoading || isInitializing || isCancelling || isMatching || isPausing}
                        className="w-full py-2.5 bg-zinc-800 text-zinc-100 font-semibold rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isResuming ? "Resuming..." : "Resume Market"}
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                <label htmlFor="tradeId" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Trade ID</label>
                <input
                    id="tradeId"
                    type="number"
                    placeholder="Trade ID"
                    value={tradeId}
                    onChange={(e) => setTradeId(e.target.value)}
                    className="w-full bg-zinc-800 border-none rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-amber-500 placeholder:text-zinc-600"
                />
                <label htmlFor="buyOrder" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Buy Order Address</label>
                <input
                    id="buyOrder"
                    type="text"
                    placeholder="Buy order public key"
                    value={buyOrderAddress}
                    onChange={(e) => setBuyOrderAddress(e.target.value)}
                    className="w-full bg-zinc-800 border-none rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-amber-500 placeholder:text-zinc-600"
                />
                <label htmlFor="sellOrder" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Sell Order Address</label>
                <input
                    id="sellOrder"
                    type="text"
                    placeholder="Sell order public key"
                    value={sellOrderAddress}
                    onChange={(e) => setSellOrderAddress(e.target.value)}
                    className="w-full bg-zinc-800 border-none rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-amber-500 placeholder:text-zinc-600"
                />
                <button
                    type="button"
                    onClick={handleMatchOrders}
                    disabled={isMatching || isLoading || isInitializing || isCancelling || isPausing || isResuming}
                    className="w-full py-2.5 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isMatching ? "Matching..." : "Match Orders"}
                </button>
            </div>

            {status && (
                <div
                    className={`p-3 rounded-lg text-sm ${status.includes("Error") ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"}`}
                    aria-live="polite"
                >
                    {status}
                </div>
            )}
        </form>
    );
}
