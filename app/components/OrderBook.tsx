"use client";

export default function OrderBook() {
    return (
        <div className="h-full flex flex-col items-center justify-center space-y-4 text-zinc-500">
            <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center">
                <span className="text-2xl">🔒</span>
            </div>
            <div className="text-center">
                <p className="font-medium text-zinc-300">Encrypted Orderbook</p>
                <p className="text-sm">Orders are matched privately in TEE.</p>
            </div>

            <div className="w-full max-w-sm space-y-2 pt-4 opacity-50">
                {[1, 2, 3].map((_, i) => (
                    <div key={i} className="flex justify-between text-xs font-mono">
                        <span className="text-emerald-500">???</span>
                        <span className="text-zinc-600">Locked</span>
                        <span className="text-rose-500">???</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
