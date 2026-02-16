import { useAccount } from "wagmi";
import { trpc } from "../lib/trpc";
import BotControl from "./BotControl";
import { useLocation } from "wouter";
import { useEffect } from "react";


export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [, setLocation] = useLocation();

  // Redirect to login if not connected
  useEffect(() => {
    if (!isConnected) {
      setLocation("/login");
    }
  }, [isConnected, setLocation]);

  // Fetch user data
  const { data: user, isLoading: userLoading, error: userError } = trpc.wallet.me.useQuery(
    undefined,
    { enabled: isConnected }
  );

  // Fetch bot config
  const { data: botConfig, isLoading: configLoading, error: configError } = trpc.config.get.useQuery(
    undefined,
    { enabled: isConnected }
  );

  // Fetch recent trades
  const { data: trades, isLoading: tradesLoading, error: tradesError } = trpc.bot.getTrades.useQuery(
    { limit: 10 },
    { enabled: isConnected }
  );

  // Log errors for debugging
  useEffect(() => {
    if (userError) console.error('[Dashboard] User error:', userError);
    if (configError) console.error('[Dashboard] Config error:', configError);
    if (tradesError) console.error('[Dashboard] Trades error:', tradesError);
  }, [userError, configError, tradesError]);

  if (!isConnected) {
    return null; // Will redirect
  }

  // Show errors if any
  if (userError || configError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-4">Error Loading Dashboard</h2>
          {userError && (
            <div className="mb-2">
              <p className="font-medium">User Error:</p>
              <p className="text-sm text-red-700">{userError.message}</p>
            </div>
          )}
          {configError && (
            <div className="mb-2">
              <p className="font-medium">Config Error:</p>
              <p className="text-sm text-red-700">{configError.message}</p>
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  if (userLoading || configLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-xl mb-2">Loading Dashboard...</div>
          <div className="text-sm text-gray-600">
            {userLoading && <div>Loading user data...</div>}
            {configLoading && <div>Loading bot config...</div>}
          </div>
        </div>
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
                {botConfig.btc15m_enabled ? (
                  <span className="text-green-600">Enabled</span>
                ) : (
                  <span className="text-gray-600">Disabled</span>
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
        {tradesError ? (
          <div className="text-red-600">
            Error loading trades: {tradesError.message}
          </div>
        ) : tradesLoading ? (
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
