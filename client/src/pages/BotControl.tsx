import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { Play, Square, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";
import { useAccount } from "wagmi";

export default function BotControl() {
  const { address, isConnected } = useAccount();
  const { data: status, refetch: refetchStatus } = trpc.bot.getStatus.useQuery();
  const { data: logs, refetch: refetchLogs } = trpc.bot.getLogs.useQuery({ limit: 100 });
  const { data: config } = trpc.config.get.useQuery();
  
  const startBot = trpc.bot.start.useMutation({
    onSuccess: () => {
      toast.success("Bot started successfully");
      refetchStatus();
      refetchLogs();
    },
    onError: (error) => {
      toast.error(`Failed to start bot: ${error.message}`);
    },
  });

  const stopBot = trpc.bot.stop.useMutation({
    onSuccess: () => {
      toast.success("Bot stopped successfully");
      refetchStatus();
      refetchLogs();
    },
    onError: (error) => {
      toast.error(`Failed to stop bot: ${error.message}`);
    },
  });

  useEffect(() => {
    const interval = setInterval(() => {
      refetchStatus();
      refetchLogs();
    }, 2000);
    return () => clearInterval(interval);
  }, [refetchStatus, refetchLogs]);

  const isRunning = status?.status === 'running';
  const isStopped = status?.status === 'stopped' || status?.status === 'error';
  const hasError = status?.errorMessage;

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-500';
      case 'warning': return 'text-yellow-500';
      case 'info': return 'text-blue-500';
      default: return 'text-muted-foreground';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertCircle className="h-3 w-3" />;
      case 'info': return <CheckCircle2 className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  // Check if wallet is connected and config exists
  const canStartBot = isConnected && config?.btc15m_enabled;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Bot Control</h2>
          <p className="text-sm text-muted-foreground">Start, stop, and monitor the trading bot</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bot Status</CardTitle>
            <CardDescription>Current bot operational status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${
                isRunning ? 'bg-green-500 animate-pulse' : 
                status?.status === 'error' ? 'bg-red-500' : 
                'bg-gray-500'
              }`} />
              <span className="text-lg font-semibold capitalize">{status?.status || 'Unknown'}</span>
            </div>

            {hasError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-destructive">Error</div>
                    <div className="text-sm text-destructive/80 mt-1">{status.errorMessage}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Wallet:</span>
                <span className="font-mono text-xs">
                  {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
                </span>
              </div>
              {status?.lastStartedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Started:</span>
                  <span>{new Date(status.lastStartedAt).toLocaleString()}</span>
                </div>
              )}
              {status?.lastStoppedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Stopped:</span>
                  <span>{new Date(status.lastStoppedAt).toLocaleString()}</span>
                </div>
              )}
              {status?.lastCycleAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Cycle:</span>
                  <span>{new Date(status.lastCycleAt).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Warning if wallet not connected */}
            {!isConnected && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-yellow-600">Wallet Not Connected</div>
                    <div className="text-sm text-yellow-600/80 mt-1">
                      Please connect your wallet to start the bot.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Warning if bot not enabled */}
            {isConnected && !config?.btc15m_enabled && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-yellow-600">Bot Not Enabled</div>
                    <div className="text-sm text-yellow-600/80 mt-1">
                      Please enable the BTC 15m strategy in the Configuration page.
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => {
                  if (!isConnected) {
                    toast.error("Please connect your wallet first");
                    return;
                  }
                  if (!config?.btc15m_enabled) {
                    toast.error("Please enable the bot in Configuration page");
                    return;
                  }
                  startBot.mutate();
                }}
                disabled={isRunning || startBot.isPending || !canStartBot}
                className="flex-1"
                title={!canStartBot ? "Connect wallet and enable bot first" : ""}
              >
                <Play className="h-4 w-4 mr-2" />
                Start Bot
              </Button>
              <Button
                onClick={() => stopBot.mutate()}
                disabled={isStopped || stopBot.isPending}
                variant="destructive"
                className="flex-1"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop Bot
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
            <CardDescription>Bot performance overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={isRunning ? "default" : "secondary"} className="capitalize">
                  {status?.status || 'Unknown'}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Wallet</span>
                <Badge variant={isConnected ? "default" : "outline"}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Strategy</span>
                <Badge variant={config?.btc15m_enabled ? "default" : "outline"}>
                  {config?.btc15m_enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bot Logs</CardTitle>
          <CardDescription>Real-time bot activity logs</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] w-full rounded-md border p-4">
            <div className="space-y-2">
              {!logs || logs.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No logs available
                </div>
              ) : (
                logs.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-2 text-sm font-mono">
                    <span className="text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`flex items-center gap-1 ${getLevelColor(log.level)}`}>
                      {getLevelIcon(log.level)}
                      [{log.level.toUpperCase()}]
                    </span>
                    <span className="flex-1">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}