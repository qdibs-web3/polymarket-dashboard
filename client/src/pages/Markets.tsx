import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { RefreshCw, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export default function Markets() {
  const { data: opportunities, refetch } = trpc.markets.getOpportunities.useQuery();
  const refreshOpportunities = trpc.markets.refreshOpportunities.useMutation({
    onSuccess: () => {
      toast.success("Market scan initiated");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to refresh: ${error.message}`);
    },
  });

  const formatCurrency = (value: number | null) => {
    if (value === null) return "-";
    return `$${value.toFixed(4)}`;
  };

  const formatPercent = (value: number | null) => {
    if (value === null) return "-";
    return `${value.toFixed(2)}%`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Market Scanner</h2>
            <p className="text-sm text-muted-foreground">Current arbitrage opportunities and market data</p>
          </div>
          <Button
            onClick={() => refreshOpportunities.mutate()}
            disabled={refreshOpportunities.isPending}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshOpportunities.isPending ? 'animate-spin' : ''}`} />
            Refresh Markets
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Arbitrage Opportunities</CardTitle>
            <CardDescription>{opportunities?.length || 0} opportunities found</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Market</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">YES Price</TableHead>
                    <TableHead className="text-right">NO Price</TableHead>
                    <TableHead className="text-right">Combined Cost</TableHead>
                    <TableHead className="text-right">Profit %</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead className="text-right">Max Position</TableHead>
                    <TableHead>Detected</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!opportunities || opportunities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        No opportunities found
                      </TableCell>
                    </TableRow>
                  ) : (
                    opportunities.map((opp) => (
                      <TableRow key={opp.id}>
                        <TableCell className="max-w-[300px]">
                          <div className="truncate" title={opp.marketQuestion}>
                            {opp.marketQuestion}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {opp.opportunityType.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(opp.yesPrice)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(opp.noPrice)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(opp.combinedCost)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-bold text-green-500">
                          <div className="flex items-center justify-end gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {formatPercent(opp.profitPct)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(opp.volume)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(opp.maxPosition)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(opp.scannedAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
