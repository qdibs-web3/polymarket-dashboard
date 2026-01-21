import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Download } from "lucide-react";

export default function Trades() {
  const [strategy, setStrategy] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(0);
  const limit = 50;

  const { data: tradesData } = trpc.trades.list.useQuery({
    strategy: strategy !== "all" ? strategy : undefined,
    status: status !== "all" ? status : undefined,
    limit,
    offset: page * limit,
  });

  const trades = tradesData?.trades || [];
  const total = tradesData?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "-";
    return `$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number | null) => {
    if (value === null) return "-";
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Trade History</h2>
            <p className="text-sm text-muted-foreground">View all executed trades with filtering and sorting</p>
          </div>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Trades</CardTitle>
                <CardDescription>{total} total trades</CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={strategy} onValueChange={setStrategy}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Strategies</SelectItem>
                    <SelectItem value="arbitrage">Arbitrage</SelectItem>
                    <SelectItem value="value_betting">Value Betting</SelectItem>
                    <SelectItem value="high_quality">High Quality</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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
                    <TableHead className="text-right">Exit Price</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                    <TableHead className="text-right">P&L %</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Entry Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        No trades found
                      </TableCell>
                    </TableRow>
                  ) : (
                    trades.map((trade) => (
                      <TableRow key={trade.id}>
                        <TableCell className="max-w-[300px]">
                          <div className="truncate" title={trade.marketQuestion}>
                            {trade.marketQuestion}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {trade.strategy.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="uppercase">
                            {trade.side}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          ${trade.entryPrice.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {trade.exitPrice ? `$${trade.exitPrice.toFixed(4)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {trade.quantity.toFixed(2)}
                        </TableCell>
                        <TableCell className={`text-right font-mono text-sm ${
                          trade.pnl && trade.pnl > 0 ? 'text-green-500' : 
                          trade.pnl && trade.pnl < 0 ? 'text-red-500' : ''
                        }`}>
                          {formatCurrency(trade.pnl)}
                        </TableCell>
                        <TableCell className={`text-right font-mono text-sm ${
                          trade.pnlPct && trade.pnlPct > 0 ? 'text-green-500' : 
                          trade.pnlPct && trade.pnlPct < 0 ? 'text-red-500' : ''
                        }`}>
                          {formatPercent(trade.pnlPct)}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              trade.status === 'closed' ? 'default' : 
                              trade.status === 'open' ? 'secondary' : 
                              'outline'
                            }
                            className="capitalize"
                          >
                            {trade.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(trade.entryTime)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total} trades
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
