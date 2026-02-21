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

  const { data: subscription } = trpc.subscription.getStatus.useQuery(
    { walletAddress: address! },
    { enabled: !!address }
  );

  const { data: stats } = trpc.bot.getStatistics.useQuery(
    undefined,
    { refetchInterval: 10000, enabled: !!address && subscription?.isActive }
  );

  const { data: recentTrades } = trpc.bot.getTrades.useQuery(
    { limit: 5, offset: 0 },
    { enabled: !!address && subscription?.isActive }
  );

  const isSubscribed = subscription?.isActive ?? false;

  /* ---------------- NON SUBSCRIBER VIEW ---------------- */

  if (!isSubscribed) {
    return (
      <div className="container mx-auto p-6 space-y-10">
        <div className="text-center space-y-4 py-12">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold gradient-text tracking-tight">
            Welcome to the Predictive Apex
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Automated Bitcoin 15-minute strategy trading on Polymarket
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="glow-on-hover transition-all duration-300 hover:bg-blue-500/5 hover:shadow-[0_0_25px_rgba(59,130,246,0.35)]">
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

          <Card className="glow-on-hover transition-all duration-300 hover:bg-blue-500/5 hover:shadow-[0_0_25px_rgba(59,130,246,0.35)]">
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

          <Card className="glow-on-hover transition-all duration-300 hover:bg-blue-500/5 hover:shadow-[0_0_25px_rgba(59,130,246,0.35)]">
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

        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold">Choose Your Plan</h2>
          <p className="text-muted-foreground">Subscribe to start automated trading</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          {/* BASIC */}
          <Card className="flex flex-col glow-on-hover transition-all duration-300 hover:bg-blue-500/5 hover:shadow-[0_0_25px_rgba(59,130,246,0.35)]">
            <CardHeader>
              <Badge className="w-fit mx-auto">Get Started</Badge>

              <div className="flex items-baseline justify-center gap-2">
                <CardTitle>Basic</CardTitle>
                <div>
                  <span className="text-3xl font-bold">$60</span>
                  <span className="text-muted-foreground text-sm"> /month</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col flex-1">
              <ul className="grid gap-2 text-sm flex-1">
                {[
                  "Core bot strategies",
                  "Limited markets",
                  "Basic analytics",
                  "Community support",
                  "Early Access"
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="text-primary">✓</span>
                    {item}
                  </li>
                ))}
              </ul>

              <Button
                className="mt-6 w-full bg-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.6)]"
                onClick={() => setLocation("/subscribe")}
              >
                Get Started
              </Button>
            </CardContent>
          </Card>

          {/* PRO */}
          <Card className="flex flex-col border-primary glow-on-hover transition-all duration-300 hover:bg-blue-500/10 hover:shadow-[0_0_30px_rgba(59,130,246,0.45)]">
            <CardHeader className="space-y-2">
              <Badge className="w-fit mx-auto">Most Popular</Badge>

              <div className="flex items-baseline justify-center gap-2">
                <CardTitle>Pro</CardTitle>
                <div>
                  <span className="text-3xl font-bold">$150</span>
                  <span className="text-muted-foreground text-sm"> /month</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col flex-1">
              <ul className="grid gap-2 text-sm flex-1">
                {[
                  "Full strategy access",
                  "Higher execution limits",
                  "Advanced analytics",
                  "Priority support",
                  "Risk management",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="text-primary">✓</span>
                    {item}
                  </li>
                ))}
              </ul>

              <Button
                className="mt-6 w-full hover:shadow-[0_0_25px_rgba(59,130,246,0.7)]"
                onClick={() => setLocation("/subscribe")}
              >
                Get Started
              </Button>
            </CardContent>
          </Card>

          {/* PREMIUM */}
          <Card className="flex flex-col glow-on-hover transition-all duration-300 hover:bg-blue-500/5 hover:shadow-[0_0_25px_rgba(59,130,246,0.35)]">
            <CardHeader>
              <Badge className="w-fit mx-auto">Pro Trader</Badge>

              <div className="flex items-baseline justify-center gap-2">
                <CardTitle>Premium</CardTitle>
                <div>
                  <span className="text-3xl font-bold">$300</span>
                  <span className="text-muted-foreground text-sm"> /month</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col flex-1">
              <ul className="grid gap-2 text-sm flex-1">
                {[
                  "Highest priority",
                  "Advanced strategies",
                  "Custom configuration",
                  "Dedicated support",
                  "Early features",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="text-primary">✓</span>
                    {item}
                  </li>
                ))}
              </ul>

              <Button
                className="mt-6 w-full hover:shadow-[0_0_20px_rgba(59,130,246,0.6)]"
                onClick={() => setLocation("/subscribe")}
              >
                Get Started
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  /* ---------------- SUBSCRIBER VIEW ---------------- */

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your automated trading performance
          </p>
        </div>

        {subscription && (
          <SubscriptionBadge tier={subscription.tier} expiresAt={subscription.expiresAt} />
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {address && <USDCBalanceCard />}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Today's P&amp;L</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                (stats?.todayPnL ?? 0) >= 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              ${(stats?.todayPnL ?? 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Bot Status</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.botRunning ? (
              <Badge>Running</Badge>
            ) : (
              <Badge variant="secondary">Stopped</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <BotStatusCard />
    </div>
  );
}