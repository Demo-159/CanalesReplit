import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { SystemMetrics, ChannelStats } from "@shared/schema";
import { Cpu, HardDrive, MemoryStick, Clock, Activity, Database, Film, Radio, Loader2 } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${mins}m`;
  }
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

function getProgressColor(percent: number): string {
  if (percent < 50) return "bg-green-500";
  if (percent < 75) return "bg-yellow-500";
  return "bg-red-500";
}

export default function MetricsPage() {
  const { data: metrics, isLoading: metricsLoading } = useQuery<SystemMetrics>({
    queryKey: ["/api/metrics"],
    refetchInterval: 3000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<ChannelStats>({
    queryKey: ["/api/stats"],
    refetchInterval: 5000,
  });

  const isLoading = metricsLoading || statsLoading;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Métricas del Sistema</h1>
        <p className="text-muted-foreground">
          Monitorea el rendimiento y uso de recursos
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-blue-500/10">
                    <Radio className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold" data-testid="text-total-channels">{stats?.totalChannels || 0}</p>
                    <p className="text-sm text-muted-foreground">Canales</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-green-500/10">
                    <Activity className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold" data-testid="text-active-streams">{stats?.activeStreams || 0}</p>
                    <p className="text-sm text-muted-foreground">En Vivo</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-purple-500/10">
                    <Film className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold" data-testid="text-prepared-assets">{stats?.totalPreparedAssets || 0}</p>
                    <p className="text-sm text-muted-foreground">Videos Listos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-orange-500/10">
                    <Database className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold" data-testid="text-storage-used">{formatBytes(stats?.totalStorageUsed || 0)}</p>
                    <p className="text-sm text-muted-foreground">Almacenamiento</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>CPU</CardTitle>
                </div>
                <CardDescription>
                  {metrics?.cpu.cores || 0} núcleos disponibles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Uso</span>
                    <span className="text-2xl font-semibold" data-testid="text-cpu-usage">
                      {(metrics?.cpu.usage || 0).toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={metrics?.cpu.usage || 0} 
                    className="h-3"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MemoryStick className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Memoria RAM</CardTitle>
                </div>
                <CardDescription>
                  {formatBytes(metrics?.memory.total || 0)} total
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {formatBytes(metrics?.memory.used || 0)} / {formatBytes(metrics?.memory.total || 0)}
                    </span>
                    <span className="text-2xl font-semibold" data-testid="text-memory-usage">
                      {(metrics?.memory.usagePercent || 0).toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={metrics?.memory.usagePercent || 0} 
                    className="h-3"
                  />
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Libre: {formatBytes(metrics?.memory.free || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Almacenamiento en Disco</CardTitle>
              </div>
              <CardDescription>
                Espacio disponible para videos segmentados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {formatBytes(metrics?.disk.used || 0)} usado de {formatBytes(metrics?.disk.total || 0)}
                  </span>
                  <span className="text-2xl font-semibold" data-testid="text-disk-usage">
                    {(metrics?.disk.usagePercent || 0).toFixed(1)}%
                  </span>
                </div>
                <Progress 
                  value={metrics?.disk.usagePercent || 0} 
                  className="h-3"
                />
                <div className="grid grid-cols-3 gap-4 pt-2">
                  <div className="text-center p-3 rounded-md bg-muted/50">
                    <p className="text-lg font-semibold" data-testid="text-disk-total">{formatBytes(metrics?.disk.total || 0)}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="text-center p-3 rounded-md bg-muted/50">
                    <p className="text-lg font-semibold" data-testid="text-disk-used">{formatBytes(metrics?.disk.used || 0)}</p>
                    <p className="text-xs text-muted-foreground">Usado</p>
                  </div>
                  <div className="text-center p-3 rounded-md bg-muted/50">
                    <p className="text-lg font-semibold text-green-600 dark:text-green-400" data-testid="text-disk-free">{formatBytes(metrics?.disk.free || 0)}</p>
                    <p className="text-xs text-muted-foreground">Libre</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Tiempo de Actividad</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold" data-testid="text-uptime">
                {formatUptime(metrics?.uptime || 0)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                El servidor ha estado funcionando sin interrupciones
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
