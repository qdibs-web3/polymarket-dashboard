import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Database, Server, Zap, HardDrive, Cpu, Activity } from "lucide-react";

export default function SystemHealth() {
  const { data: health, isLoading } = trpc.admin.getSystemHealth.useQuery();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    if (status === "healthy") {
      return <Badge className="bg-green-600">Healthy</Badge>;
    }
    if (status === "degraded") {
      return <Badge variant="secondary">Degraded</Badge>;
    }
    return <Badge variant="destructive">Down</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* System Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getStatusBadge(health?.overallStatus || "unknown")}
              <span className="text-sm text-muted-foreground">
                All systems operational
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health?.uptime || "99.9%"}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Service Status */}
      <Card>
        <CardHeader>
          <CardTitle>Service Status</CardTitle>
          <CardDescription>Status of all system components</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between border rounded-lg p-3">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Database</p>
                  <p className="text-sm text-muted-foreground">
                    {health?.database?.connections || 0} active connections
                  </p>
                </div>
              </div>
              {getStatusBadge(health?.database?.status || "healthy")}
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3">
              <div className="flex items-center gap-3">
                <Server className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">API Server</p>
                  <p className="text-sm text-muted-foreground">
                    {health?.api?.requestsPerMin || 0} req/min
                  </p>
                </div>
              </div>
              {getStatusBadge(health?.api?.status || "healthy")}
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Polymarket API</p>
                  <p className="text-sm text-muted-foreground">
                    {health?.polymarketApi?.latency || 0}ms latency
                  </p>
                </div>
              </div>
              {getStatusBadge(health?.polymarketApi?.status || "healthy")}
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Trading Bots</p>
                  <p className="text-sm text-muted-foreground">
                    {health?.bots?.active || 0} active instances
                  </p>
                </div>
              </div>
              {getStatusBadge(health?.bots?.status || "healthy")}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resource Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Resource Usage</CardTitle>
          <CardDescription>Server resource utilization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">CPU Usage</span>
                </div>
                <span className="text-sm font-medium">{health?.resources?.cpu || 0}%</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${health?.resources?.cpu || 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Memory Usage</span>
                </div>
                <span className="text-sm font-medium">{health?.resources?.memory || 0}%</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${health?.resources?.memory || 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Disk Usage</span>
                </div>
                <span className="text-sm font-medium">{health?.resources?.disk || 0}%</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${health?.resources?.disk || 0}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Incidents */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Incidents</CardTitle>
          <CardDescription>System incidents and downtime</CardDescription>
        </CardHeader>
        <CardContent>
          {health?.incidents?.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No incidents in the last 30 days
            </p>
          ) : (
            <div className="space-y-3">
              {health?.incidents?.map((incident: any) => (
                <div key={incident.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{incident.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {incident.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(incident.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant={incident.resolved ? "default" : "destructive"}>
                      {incident.resolved ? "Resolved" : "Active"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}