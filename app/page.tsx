import Header from "./components/Header";
import OrderForm from "./components/OrderForm";
import OrderBook from "./components/OrderBook";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-amber-900 selection:text-white">
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Order Form Section */}
          <div className="lg:col-span-4 space-y-6">
            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <span className="w-1 h-6 bg-amber-500 rounded-full"></span>
                Place Order
              </h2>
              <OrderForm />
            </div>
          </div>

          {/* Order Book Section */}
          <div className="lg:col-span-8 space-y-6">
            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <span className="w-1 h-6 bg-zinc-500 rounded-full"></span>
                Order Book
              </h2>
              <OrderBook />
            </div>

            {/* Recent Trades Section (Optional) */}
            <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <span className="w-1 h-6 bg-emerald-500 rounded-full"></span>
                Recent Trades
              </h2>
              <div className="h-48 flex items-center justify-center border border-dashed border-zinc-800 rounded-lg text-zinc-500">
                Recent Trades Component
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
