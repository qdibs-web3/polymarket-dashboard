import { useAccount } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

export default function Positions() {
  const { address, isConnected } = useAccount();
  
  const { data: positions, isLoading } = trpc.bot.getTrades.useQuery(
    { limit: 100, offset: 0 },
    { 
      enabled: isConnected,
      select: (data) => data.filter(trade => trade.status === 'open')
    }
  );
  
  if (!isConnected) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please connect your wallet to view positions
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Calculate statistics
  const totalValue = positions?.reduce((sum, pos) => sum + parseFloat(pos.entryValue || "0"), 0) || 0;
  const totalUnrealizedPnL = positions?.reduce((sum, pos) => sum + parseFloat(pos.pnl || "0"), 0) || 0;
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Open Positions</h1>
          <p className="text-muted-foreground">Monitor your active trades</p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
      
      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{positions?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active trades
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Invested capital
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unrealized P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalUnrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totalUnrealizedPnL >= 0 ? '+' : ''} ${totalUnrealizedPnL.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Current profit/loss
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Positions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Positions</CardTitle>
          <CardDescription>
            {positions?.length || 0} open position{positions?.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading positions...</div>
          ) : !positions || positions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No open positions</p>
              <p className="text-sm mt-2">Start the bot to begin trading</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Opened</TableHead>
                    <TableHead>Market</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Entry Price</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Unrealized P&L</TableHead>
                    <TableHead>Tx</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((position) => {
                    const pnl = parseFloat(position.pnl || "0");
                    const isProfit = pnl > 0;
                    
                    return (
                      <TableRow key={position.id}>
                        <TableCell className="font-medium">
                          {new Date(position.entryTime).toLocaleDateString()}
                            

                          <span className="text-xs text-muted-foreground">
                            {new Date(position.entryTime).toLocaleTimeString()}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate">{position.marketQuestion}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {position.strategy.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={position.side === 'yes' ? 'default' : 'secondary'}>
                            {position.side.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>${parseFloat(position.entryPrice || "0").toFixed(3)}</TableCell>
                        <TableCell>{parseFloat(position.quantity || "0").toFixed(2)}</TableCell>
                        <TableCell>${parseFloat(position.entryValue || "0").toFixed(2)}</TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-1 font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                            {isProfit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            {isProfit ? '+' : ''} ${pnl.toFixed(2)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {position.txHash && (
                            <a
                              href={`https://polygonscan.com/tx/${position.txHash}`}
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
