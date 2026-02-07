import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Save, RefreshCw } from "lucide-react";

export default function Configuration() {
  const { data: config, refetch } = trpc.config.get.useQuery();
  const updateConfig = trpc.config.update.useMutation({
    onSuccess: () => {
      toast.success("Configuration updated successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to update configuration: ${error.message}`);
    },
  });

  const [formData, setFormData] = useState({
    maxPositionSize: 50,
    maxOpenPositions: 5,
    maxDailyLoss: 25,
    targetDailyReturn: 0.02,
    minEdge: 0.05,
    kellyFraction: 0.25,
    arbitrageEnabled: true,
    arbitrageMinProfitPct: 0.8,
    valueBettingEnabled: false,
    highQualityMarketsEnabled: true,
    minVolume: 5000,
    minQualityScore: 60,
    runIntervalSeconds: 60,
    polymarketPrivateKey: '', 
    polymarketFunderAddress: '', 
  });

  useEffect(() => {
    if (config) {
      setFormData({
        maxPositionSize: config.maxPositionSize ?? 50,
        maxOpenPositions: config.maxOpenPositions ?? 5,
        maxDailyLoss: config.maxDailyLoss ?? 25,
        targetDailyReturn: config.targetDailyReturn ?? 0.02,
        minEdge: config.minEdge ?? 0.05,
        kellyFraction: config.kellyFraction ?? 0.25,
        arbitrageEnabled: config.arbitrageEnabled ?? true,
        arbitrageMinProfitPct: config.arbitrageMinProfitPct ?? 0.8,
        valueBettingEnabled: config.valueBettingEnabled ?? false,
        highQualityMarketsEnabled: config.highQualityMarketsEnabled ?? true,
        minVolume: config.minVolume ?? 5000,
        minQualityScore: config.minQualityScore ?? 60,
        runIntervalSeconds: config.runIntervalSeconds ?? 60,
        polymarketPrivateKey: config.polymarketPrivateKey ?? '', 
        polymarketFunderAddress: config.polymarketFunderAddress ?? '', 
      });
    }
  }, [config]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfig.mutate(formData);
  };

  const handleReset = () => {
    if (config) {
      setFormData({
        maxPositionSize: config.maxPositionSize ?? 50,
        maxOpenPositions: config.maxOpenPositions ?? 5,
        maxDailyLoss: config.maxDailyLoss ?? 25,
        targetDailyReturn: config.targetDailyReturn ?? 0.02,
        minEdge: config.minEdge ?? 0.05,
        kellyFraction: config.kellyFraction ?? 0.25,
        arbitrageEnabled: config.arbitrageEnabled ?? true,
        arbitrageMinProfitPct: config.arbitrageMinProfitPct ?? 0.8,
        valueBettingEnabled: config.valueBettingEnabled ?? false,
        highQualityMarketsEnabled: config.highQualityMarketsEnabled ?? true,
        minVolume: config.minVolume ?? 5000,
        minQualityScore: config.minQualityScore ?? 60,
        runIntervalSeconds: config.runIntervalSeconds ?? 60,
        polymarketPrivateKey: config.polymarketPrivateKey ?? '', 
        polymarketFunderAddress: config.polymarketFunderAddress ?? '',
      });
      toast.info("Configuration reset to saved values");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Configuration</h2>
            <p className="text-sm text-muted-foreground">Configure bot settings and risk parameters</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleReset} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="risk" className="space-y-4">
            <TabsList>
              <TabsTrigger value="risk">Risk Management</TabsTrigger>
              <TabsTrigger value="strategies">Strategies</TabsTrigger>
              <TabsTrigger value="filters">Market Filters</TabsTrigger>
              <TabsTrigger value="api">API Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="risk" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Position Sizing</CardTitle>
                  <CardDescription>Configure how much to risk per trade</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="maxPositionSize">Max Position Size ($)</Label>
                      <Input
                        id="maxPositionSize"
                        type="number"
                        step="0.01"
                        value={formData.maxPositionSize}
                        onChange={(e) => setFormData({ ...formData, maxPositionSize: parseFloat(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">Maximum amount to risk per position</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxOpenPositions">Max Open Positions</Label>
                      <Input
                        id="maxOpenPositions"
                        type="number"
                        value={formData.maxOpenPositions}
                        onChange={(e) => setFormData({ ...formData, maxOpenPositions: parseInt(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">Maximum number of concurrent positions</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="kellyFraction">Kelly Fraction</Label>
                      <Input
                        id="kellyFraction"
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={formData.kellyFraction}
                        onChange={(e) => setFormData({ ...formData, kellyFraction: parseFloat(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">Fraction of Kelly Criterion (0.25 = quarter Kelly)</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="minEdge">Min Edge (%)</Label>
                      <Input
                        id="minEdge"
                        type="number"
                        step="0.01"
                        value={formData.minEdge * 100}
                        onChange={(e) => setFormData({ ...formData, minEdge: parseFloat(e.target.value) / 100 })}
                      />
                      <p className="text-xs text-muted-foreground">Minimum edge required to enter a trade</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Risk Limits</CardTitle>
                  <CardDescription>Protect your capital with loss limits</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="maxDailyLoss">Max Daily Loss ($)</Label>
                      <Input
                        id="maxDailyLoss"
                        type="number"
                        step="0.01"
                        value={formData.maxDailyLoss}
                        onChange={(e) => setFormData({ ...formData, maxDailyLoss: parseFloat(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">Bot stops trading if daily loss exceeds this</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="targetDailyReturn">Target Daily Return (%)</Label>
                      <Input
                        id="targetDailyReturn"
                        type="number"
                        step="0.01"
                        value={formData.targetDailyReturn * 100}
                        onChange={(e) => setFormData({ ...formData, targetDailyReturn: parseFloat(e.target.value) / 100 })}
                      />
                      <p className="text-xs text-muted-foreground">Target daily return percentage (2% recommended)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="strategies" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Trading Strategies</CardTitle>
                  <CardDescription>Enable or disable specific trading strategies</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="arbitrageEnabled" className="text-base font-semibold">Arbitrage Strategy</Label>
                          <Switch
                            id="arbitrageEnabled"
                            checked={formData.arbitrageEnabled}
                            onCheckedChange={(checked) => setFormData({ ...formData, arbitrageEnabled: checked })}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Trade when YES + NO prices &lt; $1.00 for risk-free profit
                        </p>
                      </div>
                    </div>

                    {formData.arbitrageEnabled && (
                      <div className="ml-6 space-y-2 p-4 bg-muted/50 rounded-lg">
                        <Label htmlFor="arbitrageMinProfitPct">Min Arbitrage Profit (%)</Label>
                        <Input
                          id="arbitrageMinProfitPct"
                          type="number"
                          step="0.01"
                          value={formData.arbitrageMinProfitPct}
                          onChange={(e) => setFormData({ ...formData, arbitrageMinProfitPct: parseFloat(e.target.value) })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Minimum profit percentage to execute arbitrage (0.8% recommended)
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="valueBettingEnabled" className="text-base font-semibold">Value Betting Strategy</Label>
                          <Switch
                            id="valueBettingEnabled"
                            checked={formData.valueBettingEnabled}
                            onCheckedChange={(checked) => setFormData({ ...formData, valueBettingEnabled: checked })}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Trade mispriced markets based on probability estimates
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="highQualityMarketsEnabled" className="text-base font-semibold">High Quality Markets</Label>
                          <Switch
                            id="highQualityMarketsEnabled"
                            checked={formData.highQualityMarketsEnabled}
                            onCheckedChange={(checked) => setFormData({ ...formData, highQualityMarketsEnabled: checked })}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Focus on liquid, high-volume markets with tight spreads
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="filters" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Market Quality Filters</CardTitle>
                  <CardDescription>Filter markets by volume and quality</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="minVolume">Min Volume ($)</Label>
                      <Input
                        id="minVolume"
                        type="number"
                        step="100"
                        value={formData.minVolume}
                        onChange={(e) => setFormData({ ...formData, minVolume: parseFloat(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">Minimum market volume to consider ($5,000 recommended)</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="minQualityScore">Min Quality Score</Label>
                      <Input
                        id="minQualityScore"
                        type="number"
                        min="0"
                        max="100"
                        value={formData.minQualityScore}
                        onChange={(e) => setFormData({ ...formData, minQualityScore: parseInt(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">Minimum quality score 0-100 (60+ recommended)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Bot Execution</CardTitle>
                  <CardDescription>Configure how often the bot scans for opportunities</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="runIntervalSeconds">Run Interval (seconds)</Label>
                    <Input
                      id="runIntervalSeconds"
                      type="number"
                      min="30"
                      max="300"
                      value={formData.runIntervalSeconds}
                      onChange={(e) => setFormData({ ...formData, runIntervalSeconds: parseInt(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      How often to scan for opportunities (60 seconds recommended)
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="api" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Polymarket API Settings</CardTitle>
                  <CardDescription>Configure your Polymarket wallet connection</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* How to Get Credentials Help Section */}
                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-3">
                    <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                      🔑 How to Get Your Polymarket Credentials
                    </h4>
                    <ol className="text-sm text-slate-700 dark:text-slate-300 space-y-2 list-decimal list-inside">
                      <li>
                        Go to <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300">polymarket.com</a> and create an account (if you don't have one )
                      </li>
                      <li>
                        Complete at least one trade to deploy your proxy wallet
                      </li>
                      <li>
                        Click your profile → Settings → Export Private Key
                      </li>
                      <li>
                        Copy your <strong>Private Key</strong> and <strong>Wallet Address</strong>
                      </li>
                      <li>
                        Paste them in the fields below
                      </li>
                    </ol>
                  </div>

                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      <strong>⚠️ Security:</strong> Your private key is encrypted before storage. Never share it with anyone else. We only use it to execute trades on your behalf.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="polymarketPrivateKey">Polymarket Private Key *</Label>
                      <Input
                        id="polymarketPrivateKey"
                        type="password"
                        placeholder="0x..."
                        value={formData.polymarketPrivateKey || ''}
                        onChange={(e) => setFormData({ ...formData, polymarketPrivateKey: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Your Polymarket wallet private key (required to execute trades)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="polymarketFunderAddress">Funder Address *</Label>
                      <Input
                        id="polymarketFunderAddress"
                        type="text"
                        placeholder="0x..."
                        value={formData.polymarketFunderAddress || ''}
                        onChange={(e) => setFormData({ ...formData, polymarketFunderAddress: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Your Polymarket wallet address (must match the private key)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Current Status</Label>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm">
                          Credentials: {config?.polymarketPrivateKey && config?.polymarketFunderAddress ? 
                            <span className="text-green-600 dark:text-green-400 font-medium">✓ Configured</span> : 
                            <span className="text-red-600 dark:text-red-400 font-medium">✗ Not Configured</span>
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>

          <div className="flex justify-end gap-2 mt-6">
            <Button type="button" onClick={handleReset} variant="outline">
              Reset
            </Button>
            <Button type="submit" disabled={updateConfig.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updateConfig.isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
