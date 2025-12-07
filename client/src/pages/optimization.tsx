import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Cpu, 
  MemoryStick, 
  HardDrive, 
  Trash2, 
  RefreshCw, 
  Zap,
  AlertTriangle,
  CheckCircle,
  FolderX,
  Database,
  Film,
  Clock
} from "lucide-react";
import type { SystemMetrics, MaintenanceInfo, CleanupResult } from "@shared/schema";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function MetricCard({ 
  title, 
  icon: Icon, 
  value, 
  subtitle, 
  progress, 
  status 
}: { 
  title: string; 
  icon: any; 
  value: string; 
  subtitle: string; 
  progress?: number; 
  status?: "good" | "warning" | "critical";
}) {
  const statusColors = {
    good: "text-green-600 dark:text-green-400",
    warning: "text-yellow-600 dark:text-yellow-400",
    critical: "text-red-600 dark:text-red-400",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${status ? statusColors[status] : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
        {progress !== undefined && (
          <Progress value={progress} className="mt-2 h-2" />
        )}
      </CardContent>
    </Card>
  );
}

function CleanupCard({
  title,
  description,
  icon: Icon,
  count,
  size,
  onCleanup,
  isPending,
}: {
  title: string;
  description: string;
  icon: any;
  count: number;
  size: number;
  onCleanup: () => void;
  isPending: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-md bg-muted">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </div>
        <Badge variant={count > 0 ? "destructive" : "secondary"} className="shrink-0">
          {count} elementos
        </Badge>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          Espacio recuperable: <span className="font-medium text-foreground">{formatBytes(size)}</span>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onCleanup}
          disabled={isPending || count === 0}
          data-testid={`button-cleanup-${title.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          <span className="ml-2">Limpiar</span>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function OptimizationPage() {
  const { toast } = useToast();

  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery<SystemMetrics>({
    queryKey: ["/api/metrics"],
    refetchInterval: 5000,
  });

  const { data: maintenance, isLoading: maintenanceLoading, refetch: refetchMaintenance } = useQuery<MaintenanceInfo>({
    queryKey: ["/api/maintenance"],
    refetchInterval: 10000,
  });

  const cleanupDiskMutation = useMutation({
    mutationFn: () => apiRequest("/api/maintenance/cleanup-disk-assets", { method: "POST" }),
    onSuccess: (data: CleanupResult) => {
      toast({
        title: "Limpieza completada",
        description: `Se eliminaron ${data.deletedCount} elementos y se recuperaron ${formatBytes(data.reclaimedBytes)}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo completar la limpieza.", variant: "destructive" });
    },
  });

  const cleanupDbMutation = useMutation({
    mutationFn: () => apiRequest("/api/maintenance/cleanup-db-assets", { method: "POST" }),
    onSuccess: (data: CleanupResult) => {
      toast({
        title: "Limpieza completada",
        description: `Se eliminaron ${data.deletedCount} registros huerfanos.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo completar la limpieza.", variant: "destructive" });
    },
  });

  const cleanupStreamsMutation = useMutation({
    mutationFn: () => apiRequest("/api/maintenance/cleanup-streams", { method: "POST" }),
    onSuccess: (data: CleanupResult) => {
      toast({
        title: "Limpieza completada",
        description: `Se eliminaron ${data.deletedCount} streams y se recuperaron ${formatBytes(data.reclaimedBytes)}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo completar la limpieza.", variant: "destructive" });
    },
  });

  const cleanupErrorsMutation = useMutation({
    mutationFn: () => apiRequest("/api/maintenance/cleanup-error-assets", { method: "POST" }),
    onSuccess: (data: CleanupResult) => {
      toast({
        title: "Limpieza completada",
        description: `Se eliminaron ${data.deletedCount} assets con errores y se recuperaron ${formatBytes(data.reclaimedBytes)}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo completar la limpieza.", variant: "destructive" });
    },
  });

  const cleanupAllMutation = useMutation({
    mutationFn: () => apiRequest("/api/maintenance/cleanup-all", { method: "POST" }),
    onSuccess: (data: CleanupResult) => {
      toast({
        title: "Optimizacion completa",
        description: `Se eliminaron ${data.deletedCount} elementos y se recuperaron ${formatBytes(data.reclaimedBytes)}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo completar la optimizacion.", variant: "destructive" });
    },
  });

  const gcMutation = useMutation({
    mutationFn: () => apiRequest("/api/maintenance/gc", { method: "POST" }),
    onSuccess: (data: { memoryBefore: number; memoryAfter: number }) => {
      const freed = data.memoryBefore - data.memoryAfter;
      toast({
        title: "Memoria optimizada",
        description: freed > 0 
          ? `Se liberaron ${formatBytes(freed)} de memoria.`
          : "La memoria ya estaba optimizada.",
      });
      refetchMetrics();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo optimizar la memoria.", variant: "destructive" });
    },
  });

  const getMemoryStatus = (percent: number): "good" | "warning" | "critical" => {
    if (percent < 70) return "good";
    if (percent < 85) return "warning";
    return "critical";
  };

  const getCpuStatus = (percent: number): "good" | "warning" | "critical" => {
    if (percent < 60) return "good";
    if (percent < 80) return "warning";
    return "critical";
  };

  const getDiskStatus = (percent: number): "good" | "warning" | "critical" => {
    if (percent < 70) return "good";
    if (percent < 85) return "warning";
    return "critical";
  };

  const isAnyCleanupPending = 
    cleanupDiskMutation.isPending || 
    cleanupDbMutation.isPending || 
    cleanupStreamsMutation.isPending || 
    cleanupErrorsMutation.isPending ||
    cleanupAllMutation.isPending;

  const orphanedDiskSize = maintenance?.orphanedResources
    .filter(r => r.type === "orphaned_disk_asset")
    .reduce((sum, r) => sum + r.size, 0) || 0;

  const staleStreamsSize = maintenance?.orphanedResources
    .filter(r => r.type === "stale_stream")
    .reduce((sum, r) => sum + r.size, 0) || 0;

  const errorAssetsSize = maintenance?.orphanedResources
    .filter(r => r.type === "error_asset")
    .reduce((sum, r) => sum + r.size, 0) || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Optimizacion del Sistema</h1>
          <p className="text-muted-foreground">
            Monitorea recursos y libera espacio en disco
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            onClick={() => { refetchMetrics(); refetchMaintenance(); }}
            data-testid="button-refresh-metrics"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button 
            onClick={() => cleanupAllMutation.mutate()}
            disabled={isAnyCleanupPending || (maintenance?.totalReclaimableSize || 0) === 0}
            data-testid="button-optimize-all"
          >
            {cleanupAllMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Optimizar Todo
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="CPU"
          icon={Cpu}
          value={metricsLoading ? "..." : `${metrics?.cpu.usage.toFixed(1)}%`}
          subtitle={metricsLoading ? "Cargando..." : `${metrics?.cpu.cores} nucleos`}
          progress={metrics?.cpu.usage}
          status={metrics ? getCpuStatus(metrics.cpu.usage) : undefined}
        />
        <MetricCard
          title="Memoria RAM"
          icon={MemoryStick}
          value={metricsLoading ? "..." : `${metrics?.memory.usagePercent.toFixed(1)}%`}
          subtitle={metricsLoading ? "Cargando..." : `${formatBytes(metrics?.memory.used || 0)} / ${formatBytes(metrics?.memory.total || 0)}`}
          progress={metrics?.memory.usagePercent}
          status={metrics ? getMemoryStatus(metrics.memory.usagePercent) : undefined}
        />
        <MetricCard
          title="Disco"
          icon={HardDrive}
          value={metricsLoading ? "..." : `${metrics?.disk.usagePercent.toFixed(1)}%`}
          subtitle={metricsLoading ? "Cargando..." : `${formatBytes(metrics?.disk.used || 0)} / ${formatBytes(metrics?.disk.total || 0)}`}
          progress={metrics?.disk.usagePercent}
          status={metrics ? getDiskStatus(metrics.disk.usagePercent) : undefined}
        />
        <MetricCard
          title="Tiempo Activo"
          icon={Clock}
          value={metricsLoading ? "..." : formatUptime(metrics?.uptime || 0)}
          subtitle="Sistema en ejecucion"
        />
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <Card className="flex-1 min-w-[200px]">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {(maintenance?.totalReclaimableSize || 0) > 0 ? (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              <div>
                <div className="font-medium">Espacio Recuperable</div>
                <div className="text-sm text-muted-foreground">
                  {maintenanceLoading ? "Analizando..." : formatBytes(maintenance?.totalReclaimableSize || 0)}
                </div>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => gcMutation.mutate()}
              disabled={gcMutation.isPending}
              data-testid="button-gc"
            >
              {gcMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <MemoryStick className="h-4 w-4" />
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div>
        <h2 className="text-lg font-semibold mb-4">Acciones de Limpieza</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <CleanupCard
            title="Assets Huerfanos (Disco)"
            description="Archivos en disco sin registro en la base de datos"
            icon={FolderX}
            count={maintenance?.orphanedDiskAssetCount || 0}
            size={orphanedDiskSize}
            onCleanup={() => cleanupDiskMutation.mutate()}
            isPending={cleanupDiskMutation.isPending}
          />
          <CleanupCard
            title="Registros Huerfanos (DB)"
            description="Registros en base de datos sin archivos en disco"
            icon={Database}
            count={maintenance?.orphanedDbAssetCount || 0}
            size={0}
            onCleanup={() => cleanupDbMutation.mutate()}
            isPending={cleanupDbMutation.isPending}
          />
          <CleanupCard
            title="Streams Inactivos"
            description="Segmentos de canales que ya no estan en vivo"
            icon={Film}
            count={maintenance?.staleStreamCount || 0}
            size={staleStreamsSize}
            onCleanup={() => cleanupStreamsMutation.mutate()}
            isPending={cleanupStreamsMutation.isPending}
          />
          <CleanupCard
            title="Assets con Errores"
            description="Videos que fallaron durante el procesamiento"
            icon={AlertTriangle}
            count={maintenance?.errorAssetCount || 0}
            size={errorAssetsSize}
            onCleanup={() => cleanupErrorsMutation.mutate()}
            isPending={cleanupErrorsMutation.isPending}
          />
        </div>
      </div>

      {maintenance && maintenance.orphanedResources.length > 0 && (
        <>
          <Separator />
          <div>
            <h2 className="text-lg font-semibold mb-4">Recursos Detectados</h2>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {maintenance.orphanedResources.slice(0, 10).map((resource, index) => (
                    <div key={`${resource.type}-${resource.id}-${index}`} className="flex items-center justify-between gap-4 p-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {resource.type === "orphaned_disk_asset" && <FolderX className="h-4 w-4 shrink-0 text-orange-500" />}
                        {resource.type === "orphaned_db_asset" && <Database className="h-4 w-4 shrink-0 text-blue-500" />}
                        {resource.type === "stale_stream" && <Film className="h-4 w-4 shrink-0 text-purple-500" />}
                        {resource.type === "error_asset" && <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />}
                        <div className="min-w-0">
                          <div className="font-mono text-sm truncate" data-testid={`text-resource-id-${index}`}>
                            {resource.id.substring(0, 8)}...
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {resource.reason}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground shrink-0">
                        {formatBytes(resource.size)}
                      </div>
                    </div>
                  ))}
                  {maintenance.orphanedResources.length > 10 && (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Y {maintenance.orphanedResources.length - 10} elementos mas...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
