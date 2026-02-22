import { useAccount, useChainId } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";

export function USDCBalanceCard() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { balance, isLoading, isError, refetch } = useUSDCBalance(address);

  const isPolygon = chainId === 137;
  const isAmoy = chainId === 80002;
  const networkLabel = isPolygon ? "Polygon" : isAmoy ? "Amoy Testnet" : `Chain ${chainId}`;
  const networkColor = isPolygon
    ? "border-purple-500/50 text-purple-400"
    : isAmoy
    ? "border-yellow-500/50 text-yellow-400"
    : "border-red-500/50 text-red-400";

  const showNetworkWarning = !isPolygon && !isAmoy;

  return (
    <Card className="bg-[#18181b] border-[#27272a]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            <CardTitle>USDC Balance</CardTitle>
          </div>
          <Badge variant="outline" className={networkColor}>
            {networkLabel}
          </Badge>
        </div>
        <CardDescription className="text-gray-400">
          Your available trading balance
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {showNetworkWarning && (
          <div className="flex items-center gap-2 text-yellow-400 text-xs bg-yellow-500/10 rounded-md px-3 py-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Switch to Polygon Mainnet to see your USDC balance.</span>
          </div>
        )}

        {isError && !showNetworkWarning && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 rounded-md px-3 py-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Could not read balance. Check your network connection.</span>
          </div>
        )}

        <div className="flex items-baseline gap-2">
          {isLoading ? (
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          ) : (
            <>
              <span className="text-4xl font-bold">{parseFloat(balance).toFixed(2)}</span>
              <span className="text-xl text-gray-400">USDC</span>
            </>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Balance
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}