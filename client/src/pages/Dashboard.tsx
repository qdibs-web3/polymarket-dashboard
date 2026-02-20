import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, DollarSign, Activity, BarChart3, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "wagmi";
import { Link, useLocation } from "wouter";
import { BotStatusCard } from "../components/BotStatusCard";
import { SubscriptionBadge } from "../components/SubscriptionBadge";
import { USDCBalanceCard } from "../components/USDCBalanceCard";

export default function Dashboard() {
  const { address } = useAccount();
  const [, setLocation] = useLocation();

  // Check subscription status
  const { data: subscription } = trpc.subscription.getStatus.useQuery(
    { walletAddress: address! },
    { enabled: !!address }
  );

  // Get bot statistics
  const { data: stats } = trpc.bot.getStatistics.useQuery(
    undefined,
    { refetchInterval: 10000, enabled: !!address && subscription?.isActive }
  );

  // Get recent trades
  const { data: recentTrades } = trpc.bot.getTrades.useQuery(
    { limit: 5, offset: 0 },
    { enabled: !!address && subscription?.isActive }
  );

  // Get bot config
  const { data: config } = trpc.config.get.useQuery(
    undefined,
    { enabled: !!address && subscription?.isActive }
  );

  const isSubscribed = subscription?.isActive ?? false;

  // Non-subscriber view
  if (!isSubscribed) {
    return (
      <div className="container mx-auto p-6 space-y-8">
        <div className="text-center space-y-4 py-12">
          <h1 className="text-4xl font-bold gradient-text">
            Welcome to Polymarket Trading Bot
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Automated Bitcoin 15-minute strategy trading on Polymarket
          </p>
        </div>

        {/* Features Section */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="glow-on-hover">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Automated Trading
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                15-minute Bitcoin strategy executes trades automatically based on technical indicators
              </p>
            </CardContent>
          </Card>

          <Card className="glow-on-hover">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Real-time Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Track your performance with detailed statistics and trade history
              </p>
            </CardContent>
          </Card>

          <Card className="glow-on-hover">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Non-Custodial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Your funds stay in your wallet. Revoke access anytime.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Pricing Tiers */}
        <div className="text-center space-y-4 pt-8">
          <h2 className="text-3xl font-bold">Choose Your Plan</h2>
          <p className="text-muted-foreground">
            Subscribe to start automated trading
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          {/* Basic Tier */}
          <Card className="glow-on-hover">
            <CardHeader>
              <CardTitle>Basic</CardTitle>
              <CardDescription>
                <span className="text-3xl font-bold">$60</span>
                <span className="text-muted-foreground">/month</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Core bot strategies
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Limited markets
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Basic analytics
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Community support
                </li>
              </ul>
              <Button className="w-full" onClick={() => setLocation("/subscribe")}>
                Get Started
              </Button>
            </CardContent>
          </Card>

          {/* Pro Tier */}
          <Card className="glow-on-hover border-primary">
            <CardHeader>
              <Badge className="w-fit mb-2">Popular</Badge>
              <CardTitle>Pro</CardTitle>
              <CardDescription>
                <span className="text-3xl font-bold">$150</span>
                <span className="text-muted-foreground">/month</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Full strategy access
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Higher execution limits
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Advanced analytics
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Priority support
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Risk management
                </li>
              </ul>
              <Button className="w-full" onClick={() => setLocation("/subscribe")}>
                Get Started
              </Button>
            </CardContent>
          </Card>

          {/* Premium Tier */}
          <Card className="glow-on-hover">
            <CardHeader>
              <CardTitle>Premium</CardTitle>
              <CardDescription>
                <span className="text-3xl font-bold">$300</span>
                <span className="text-muted-foreground">/month</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Highest priority
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Advanced strategies
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Custom configuration
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  API access
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Dedicated support
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Early features
                </li>
              </ul>
              <Button className="w-full" onClick={() => setLocation("/subscribe")}>
                Get Started
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Subscriber dashboard view
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your automated trading performance
          </p>
        </div>
        <SubscriptionBadge 
        tier={subscription?.tier} 
        expiresAt={subscription?.expiresAt != null ? new Date(subscription.expiresAt * 1000) : undefined}
      />
      </div>

      {/* Top Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {address && <USDCBalanceCard walletAddress={address} />}
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's P&L</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              (stats?.todayPnL ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              ${(stats?.todayPnL ?? 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.todayTrades ?? 0} trades today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bot Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.botRunning ? (
                <Badge variant="default">Running</Badge>
              ) : (
                <Badge variant="secondary">Stopped</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.openPositions ?? 0} open positions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bot Control */}
      <BotStatusCard />

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/trades">
          <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
            <BarChart3 className="h-5 w-5" />
            <span>View All Trades</span>
          </Button>
        </Link>
        <Link href="/positions">
          <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
            <Activity className="h-5 w-5" />
            <span>Open Positions</span>
          </Button>
        </Link>
        <Link href="/logs">
          <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
            <Clock className="h-5 w-5" />
            <span>Activity Logs</span>
          </Button>
        </Link>
      </div>


      {/* Recent Trades */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Trades</CardTitle>
          <CardDescription>Your latest trading activity</CardDescription>
        </CardHeader>
        <CardContent>
          {!recentTrades || recentTrades.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No trades yet. Start the bot to begin trading.
            </div>
          ) : (
            <div className="space-y-4">
              {recentTrades.map((trade: any) => {
                const pnl = trade.pnl ? parseFloat(trade.pnl) : 0;
                const isProfitable = pnl >= 0;
                
                return (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      {trade.side === "yes" ? (
                        <TrendingUp className="h-5 w-5 text-green-500" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <p className="font-medium">{trade.marketQuestion}</p>
                        <p className="text-sm text-muted-foreground">
                          {trade.strategy} • {trade.side.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${
                        isProfitable ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {isProfitable ? '+' : ''}${pnl.toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {new Date(trade.entryTime).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant={trade.status === "open" ? "default" : "secondary"}>
                      {trade.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glow-on-hover cursor-pointer" onClick={() => setLocation("/config")}>
          <CardHeader>
            <CardTitle className="text-lg">Bot Configuration</CardTitle>
            <CardDescription>
              Adjust trading parameters and risk settings
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="glow-on-hover cursor-pointer" onClick={() => setLocation("/trades")}>
          <CardHeader>
            <CardTitle className="text-lg">View All Trades</CardTitle>
            <CardDescription>
              Complete trading history and analytics
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}