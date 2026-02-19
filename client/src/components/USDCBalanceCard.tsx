import { useAccount } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, RefreshCw, Loader2 } from "lucide-react";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";

export function USDCBalanceCard() {
  const { address } = useAccount();
  const { balance, isLoading, refetch } = useUSDCBalance(address);

  const handleRefresh = () => {
    refetch();
  };

  return (
    <Card className="bg-[#18181b] border-[#27272a]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            <CardTitle>USDC Balance</CardTitle>
          </div>
          <Badge variant="outline" className="border-purple-500/50 text-purple-400">
            Polygon
          </Badge>
        </div>
        <CardDescription className="text-gray-400">
          Your available trading balance
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-2">
          {isLoading ? (
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          ) : (
            <>
              <span className="text-4xl font-bold">{balance}</span>
              <span className="text-xl text-gray-400">USDC</span>
            </>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
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
