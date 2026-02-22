import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Square, Activity, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface BotLog {
  id: string;
  level: "info" | "success" | "warning" | "error";
  timestamp: Date;
  message: string;
}

export function BotStatusCard() {
  const [logs, setLogs] = useState<BotLog[]>([]);
  
  // Bot status query - no input needed, uses ctx.user from protected procedure
  const { data: botStatus } = trpc.bot.getStatus.useQuery(
    undefined,
    { refetchInterval: 5000 }
  );

  // Start bot mutation
  const startBot = trpc.bot.start.useMutation({
    onSuccess: () => {
      addLog("success", "Bot started successfully");
    },
    onError: (error) => {
      addLog("error", `Failed to start bot: ${error.message}`);
    },
  });

  // Stop bot mutation
  const stopBot = trpc.bot.stop.useMutation({
    onSuccess: () => {
      addLog("info", "Bot stopped");
    },
    onError: (error) => {
      addLog("error", `Failed to stop bot: ${error.message}`);
    },
  });

  // Fetch logs from backend
  const { data: backendLogs } = trpc.bot.getLogs.useQuery(
    { limit: 50 },
    { refetchInterval: 10000 }
  );

  // Sync backend logs with local logs
  useEffect(() => {
    if (backendLogs && backendLogs.length > 0) {
      const formattedLogs: BotLog[] = backendLogs.map((log: any) => ({
        id: log.id.toString(),
        level: log.level as BotLog["level"],
        timestamp: new Date(log.timestamp),
        message: log.message,
      }));
      setLogs(formattedLogs);
    }
  }, [backendLogs]);

  const addLog = (level: BotLog["level"], message: string) => {
    const newLog: BotLog = {
      id: Date.now().toString(),
      level,
      timestamp: new Date(),
      message,
    };
    setLogs((prev) => [newLog, ...prev].slice(0, 50)); // Keep last 50 logs
  };

  const handleStart = () => {
    startBot.mutate();
  };

  const handleStop = () => {
    stopBot.mutate();
  };

  const isActive = botStatus?.isActive ?? false;
  const isLoading = startBot.isPending || stopBot.isPending;
  const statusBadge = botStatus?.status || "stopped";

  return (
    <Card className="glow-on-hover">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Bot Status
            </CardTitle>
            <CardDescription>
              15-Minute Bitcoin Strategy
            </CardDescription>
          </div>
          <Badge 
            variant={isActive ? "default" : "secondary"} 
            className="text-sm capitalize"
          >
            {statusBadge}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            onClick={handleStart}
            disabled={isActive || isLoading}
            className="flex-1 bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_18px_4px_rgba(59,130,246,0.55)] transition-all duration-200 disabled:opacity-40 disabled:shadow-none"
            size="lg"
          >
            <Play className="mr-2 h-4 w-4" />
            Start Bot
          </Button>
          <Button
            onClick={handleStop}
            disabled={!isActive || isLoading}
            variant="destructive"
            className="flex-1 hover:shadow-[0_0_18px_4px_rgba(239,68,68,0.50)] transition-all duration-200 disabled:opacity-40 disabled:shadow-none"
            size="lg"
          >
            <Square className="mr-2 h-4 w-4" />
            Stop Bot
          </Button>
        </div>

        {botStatus && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            {botStatus.lastStartedAt && (
              <div>
                <p className="text-muted-foreground">Last Started</p>
                <p className="font-medium">
                  {new Date(botStatus.lastStartedAt).toLocaleString()}
                </p>
              </div>
            )}
            {botStatus.lastCycleAt && (
              <div>
                <p className="text-muted-foreground">Last Cycle</p>
                <p className="font-medium">
                  {new Date(botStatus.lastCycleAt).toLocaleString()}
                </p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Today's Trades</p>
              <p className="font-medium">{botStatus.todayTrades}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Today's P&L</p>
              <p className={`font-medium ${botStatus.todayPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                ${botStatus.todayPnl.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {botStatus?.errorMessage && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <p>{botStatus.errorMessage}</p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Activity Log</h4>
            {logs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLogs([])}
              >
                Clear
              </Button>
            )}
          </div>
          <ScrollArea className="h-[200px] w-full rounded-md border p-4">
            {logs.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No activity yet. Start the bot to see logs.
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 text-sm"
                  >
                    {log.level === "error" && (
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    )}
                    {log.level === "success" && (
                      <Activity className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    )}
                    {log.level === "warning" && (
                      <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    )}
                    {log.level === "info" && (
                      <Activity className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 space-y-1 min-w-0">
                      <p className={`break-words ${
                        log.level === "error" ? "text-destructive" :
                        log.level === "success" ? "text-green-500" :
                        log.level === "warning" ? "text-yellow-500" :
                        "text-foreground"
                      }`}>
                        {log.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}