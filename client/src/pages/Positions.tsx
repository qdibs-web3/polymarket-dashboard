import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

export default function Positions() {
  const { data: positions, refetch } = trpc.positions.list.useQuery();
  const closePosition = trpc.positions.close.useMutation({
    onSuccess: () => {
      toast.success("Position closed successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to close position: ${error.message}`);
    },
  });

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  const formatCurrency = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const totalUnrealizedPnl = positions?.reduce((sum, p) => sum + p.unrealizedPnl, 0) || 0;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Open Positions</h2>
            <p className="text-sm text-muted-foreground">Manage your active positions</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Total Unrealized P&L</div>
              <div className={`text-xl font-bold \${
                totalUnrealizedPnl > 0 ? 'text-green-500' : 
                totalUnrealizedPnl < 0 ? 'text-red-500' : ''
              }`}>
                {formatCurrency(totalUnrealizedPnl)}
              </div>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active Positions</CardTitle>
            <CardDescription>{positions?.length || 0} open positions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Market</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead className="text-right">Entry Price</TableHead>
                    <TableHead className="text-right">Current Price</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Entry Value</TableHead>
                    <TableHead className="text-right">Current Value</TableHead>
                    <TableHead className="text-right">Unrealized P&L</TableHead>
                    <TableHead className="text-right">P&L %</TableHead>
                    <TableHead>Opened</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!positions || positions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                        No open positions
                      </TableCell>
                    </TableRow>
                  ) : (
                    positions.map((position) => {
                      const isProfitable = position.unrealizedPnl > 0;
                      return (
                        <TableRow key={position.id}>
                          <TableCell className="max-w-[300px]">
                            <div className="truncate" title={position.marketQuestion}>
                              {position.marketQuestion}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {position.strategy.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="uppercase">
                              {position.side}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            \${position.entryPrice.toFixed(4)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            <div className="flex items-center justify-end gap-1">
                              \${position.currentPrice.toFixed(4)}
                              {isProfitable ? (
                                <TrendingUp className="h-3 w-3 text-green-500" />
                              ) : (
                                <TrendingDown className="h-3 w-3 text-red-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {position.quantity.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(position.entryValue)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(position.currentValue)}
                          </TableCell>
                          <TableCell className={`text-right font-mono text-sm font-bold \${
                            isProfitable ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {formatCurrency(position.unrealizedPnl)}
                          </TableCell>
                          <TableCell className={`text-right font-mono text-sm \${
                            isProfitable ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {formatPercent(position.unrealizedPnlPct)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(position.openedAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => closePosition.mutate({ positionId: position.id })}
                              disabled={closePosition.isPending}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
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
