import { useAccount } from "wagmi";
import { trpc } from "../lib/trpc";
import BotControl from "../pages/BotControl";
import { useLocation } from "wouter";
import { useEffect } from "react";


export function Dashboard() {
  const { address, isConnected } = useAccount();
  const [, setLocation] = useLocation();

  // Redirect to login if not connected
  useEffect(() => {
    if (!isConnected) {
      setLocation("/login");
    }
  }, [isConnected, setLocation]);

  // Fetch user data
  const { data: user, isLoading: userLoading } = trpc.wallet.me.useQuery(
    undefined,
    { enabled: isConnected }
  );

  // Fetch bot config
  const { data: botConfig, isLoading: configLoading } = trpc.config.get.useQuery(
    undefined,
    { enabled: isConnected }
  );

  // Fetch recent trades
  const { data: trades, isLoading: tradesLoading } = trpc.bot.getTrades.useQuery(
    { limit: 10 },
    { enabled: isConnected }
  );

  if (!isConnected) {
    return null; // Will redirect
  }

  if (userLoading || configLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-gray-600">
          Welcome, {address?.slice(0, 6)}...{address?.slice(-4)}
        </p>
      </div>

      {/* Subscription Status */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Subscription Status</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Tier</p>
            <p className="text-lg font-medium capitalize">
              {user?.subscriptionTier || "None"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <p className="text-lg font-medium capitalize">
              {user?.subscriptionStatus || "Inactive"}
            </p>
          </div>
        </div>
      </div>

      {/* Bot Control */}
      <div className="mb-6">
        <BotControl />
      </div>

      {/* Bot Configuration */}
      {botConfig && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Bot Configuration</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Strategy</p>
              <p className="text-lg font-medium">Bitcoin 15m</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="text-lg font-medium">
                {botConfig.isActive ? (
                  <span className="text-green-600">Active</span>
                ) : (
                  <span className="text-gray-600">Inactive</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Edge Threshold</p>
              <p className="text-lg font-medium">
                {botConfig.btc15m_edge_threshold}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Trades */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Trades</h2>
        {tradesLoading ? (
          <p>Loading trades...</p>
        ) : trades && trades.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Market</th>
                  <th className="text-left py-2">Side</th>
                  <th className="text-right py-2">Amount</th>
                  <th className="text-right py-2">P&L</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr key={trade.id} className="border-b">
                    <td className="py-2">
                      {new Date(trade.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2">{trade.strategy}</td>
                    <td className="py-2 capitalize">{trade.side}</td>
                    <td className="py-2 text-right">
                      ${parseFloat(trade.entryValue).toFixed(2)}
                    </td>
                    <td
                      className={`py-2 text-right ${
                        parseFloat(trade.pnl || "0") >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      ${trade.pnl ? parseFloat(trade.pnl).toFixed(2) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600">No trades yet</p>
        )}
      </div>
    </div>
  );
}

export default Dashboard;