import { useState } from "react";
import { useAccount } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, ExternalLink, Filter } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

export default function Trades() {
  const { address, isConnected } = useAccount();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [strategyFilter, setStrategyFilter] = useState<string>("all");
  
  const { data: trades, isLoading } = trpc.bot.getTrades.useQuery(
    { limit: 100, offset: 0 },
    { enabled: isConnected }
  );
  
  if (!isConnected) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please connect your wallet to view trades
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Filter trades
  const filteredTrades = trades?.filter(trade => {
    if (statusFilter !== "all" && trade.status !== statusFilter) return false;
    if (strategyFilter !== "all" && trade.strategy !== strategyFilter) return false;
    return true;
  }) || [];
  
  // Calculate statistics
  const totalPnL = filteredTrades.reduce((sum, trade) => sum + (parseFloat(trade.pnl || "0")), 0);
  const winningTrades = filteredTrades.filter(t => parseFloat(t.pnl || "0") > 0).length;
  const winRate = filteredTrades.length > 0 ? (winningTrades / filteredTrades.length * 100) : 0;
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trade History</h1>
          <p className="text-muted-foreground">View all your executed trades</p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
      
      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totalPnL >= 0 ? '+' : ''} ${totalPnL.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {filteredTrades.length} trades
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{winRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {winningTrades} / {filteredTrades.length} wins
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Trade Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${filteredTrades.length > 0 
                ? (filteredTrades.reduce((sum, t) => sum + parseFloat(t.entryValue || "0"), 0) / filteredTrades.length).toFixed(2)
                : "0.00"
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Per trade
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Strategy</label>
            <Select value={strategyFilter} onValueChange={setStrategyFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Strategies</SelectItem>
                <SelectItem value="btc15m_up">BTC 15m UP</SelectItem>
                <SelectItem value="btc15m_down">BTC 15m DOWN</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {/* Trades Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Trades</CardTitle>
          <CardDescription>
            {filteredTrades.length} trade{filteredTrades.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading trades...</div>
          ) : filteredTrades.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No trades found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Market</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead>Exit</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>P&L</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tx</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrades.map((trade) => {
                    const pnl = parseFloat(trade.pnl || "0");
                    const isProfit = pnl > 0;
                    
                    return (
                      <TableRow key={trade.id}>
                        <TableCell className="font-medium">
                          {new Date(trade.entryTime).toLocaleDateString()}
                            

                          <span className="text-xs text-muted-foreground">
                            {new Date(trade.entryTime).toLocaleTimeString()}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {trade.marketQuestion}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {trade.strategy.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={trade.side === 'yes' ? 'default' : 'secondary'}>
                            {trade.side.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>${parseFloat(trade.entryPrice || "0").toFixed(3)}</TableCell>
                        <TableCell>
                          {trade.exitPrice ? `$${parseFloat(trade.exitPrice).toFixed(3)}` : '-'}
                        </TableCell>
                        <TableCell>${parseFloat(trade.entryValue || "0").toFixed(2)}</TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-1 font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                            {isProfit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            {isProfit ? '+' : ''} ${pnl.toFixed(2)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            trade.status === 'open' ? 'default' :
                            trade.status === 'closed' ? 'secondary' :
                            'outline'
                          }>
                            {trade.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {trade.txHash && (
                            <a
                              href={`https://polygonscan.com/tx/${trade.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View
                            </a>
                           )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
