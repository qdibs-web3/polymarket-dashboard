import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { TrendingUp, TrendingDown, DollarSign, Target, Award, Activity } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import Subscribe from "./Subscribe";
import SubscriptionUpgrade from "@/components/SubscriptionUpgrade";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";

export default function Dashboard() {
  const { user } = useAuth();
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  
  // Always fetch data, but show upgrade prompts if not subscribed
  const { data: metrics, refetch: refetchMetrics } = trpc.dashboard.getMetrics.useQuery();
  const { data: equityCurve } = trpc.dashboard.getEquityCurve.useQuery({ days: 30 });
  const { data: strategyBreakdown } = trpc.dashboard.getStrategyBreakdown.useQuery();
  
  const isSubscribed = user?.subscriptionStatus === 'active';
  
  // Handle Stripe redirect query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscription = params.get('subscription');
    
    if (subscription === 'success') {
      toast({
        title: "Payment Successful!",
        description: "Your subscription is being activated. This may take a few moments.",
      });
      // Clean URL
      setLocation('/dashboard');
    } else if (subscription === 'cancelled') {
      toast({
        title: "Payment Cancelled",
        description: "Your subscription was not activated. You can try again anytime.",
        variant: "destructive",
      });
      // Clean URL
      setLocation('/dashboard');
    }
  }, [toast, setLocation]);
  
  // Auto-refresh every 5 seconds for subscribed users
  useEffect(() => {
    if (!isSubscribed) return;
    const interval = setInterval(() => {
      refetchMetrics();
    }, 5000);
    return () => clearInterval(interval);
  }, [refetchMetrics, isSubscribed]);

  const dailyPnl = parseFloat(metrics?.dailyPnl || "0");
  const totalPnl = parseFloat(metrics?.totalPnl || "0");
  const currentBalance = parseFloat(metrics?.currentBalance || "0");
  const winRate = parseFloat(metrics?.winRate || "0");
  const profitFactor = parseFloat(metrics?.profitFactor || "0");

  const isProfitable = dailyPnl >= 0;

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'];

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Dashboard</h2>
            <p className="text-sm text-muted-foreground">Real-time performance metrics and bot status</p>
          </div>
          <div className="flex items-center gap-4">
            {isSubscribed && (
              <Link href="/payment-history">
                <Button variant="outline" size="sm">
                  Payment History
                </Button>
              </Link>
            )}
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${metrics?.botStatus === 'running' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-sm font-medium">
                {metrics?.botStatus === 'running' ? 'Running' : 'Stopped'}
              </span>
            </div>
          </div>
        </div>

        {/* Upgrade Section for Non-Subscribers */}
        {!isSubscribed && (
          <SubscriptionUpgrade onUpgradeClick={() => setShowSubscribeModal(true)} />
        )}

        {/* Metrics Cards - Only show for subscribed users */}
        {isSubscribed && (
        <>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Daily P&L</CardTitle>
              {isProfitable ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${isProfitable ? 'text-green-500' : 'text-red-500'}`}>
                ${dailyPnl.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isProfitable ? '+' : ''}{((dailyPnl / (currentBalance - dailyPnl || 1)) * 100).toFixed(2)}% today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${currentBalance.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Total P&L: ${totalPnl.toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{winRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics?.winningTrades || 0}W / {metrics?.losingTrades || 0}L
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Profit Factor</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profitFactor.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Total trades: {metrics?.totalTrades || 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Positions</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.openPositionsCount || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Active positions
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Equity Curve</CardTitle>
              <CardDescription>Account balance over time (30 days)</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={equityCurve || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="balance" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily Returns</CardTitle>
              <CardDescription>Profit/loss by day (30 days)</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={equityCurve || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Bar 
                    dataKey="pnl" 
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Strategy Performance</CardTitle>
              <CardDescription>Profit breakdown by strategy</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={strategyBreakdown || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="profit"
                  >
                    {(strategyBreakdown || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance Summary</CardTitle>
              <CardDescription>Key statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Trades</span>
                  <span className="text-sm font-medium">{metrics?.totalTrades || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Winning Trades</span>
                  <span className="text-sm font-medium text-green-500">{metrics?.winningTrades || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Losing Trades</span>
                  <span className="text-sm font-medium text-red-500">{metrics?.losingTrades || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Win Rate</span>
                  <span className="text-sm font-medium">{winRate.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Profit Factor</span>
                  <span className="text-sm font-medium">{profitFactor.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Open Positions</span>
                  <span className="text-sm font-medium">{metrics?.openPositionsCount || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </>
        )}
      </div>

      {/* Subscription Modal */}
      <Dialog open={showSubscribeModal} onOpenChange={setShowSubscribeModal}>
        <DialogContent className="max-w-[1400px] w-[1400px]">
          <Subscribe />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}