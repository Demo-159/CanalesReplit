import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PreparedAsset } from "@shared/schema";
import { Plus, Film, HardDrive, Clock, MoreVertical, Trash2, RefreshCw, XCircle, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const createAssetSchema = z.object({
  title: z.string().min(1, "El título es requerido").max(255),
  sourceUrl: z.string().url("URL inválida"),
  segmentDuration: z.number().min(2).max(10).default(4),
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m ${secs}s`;
}

function getStatusBadge(status: PreparedAsset["status"]) {
  switch (status) {
    case "ready":
      return (
        <Badge variant="default" className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30">
          <CheckCircle className="h-3 w-3 mr-1" />
          Listo
        </Badge>
      );
    case "processing":
      return (
        <Badge variant="secondary">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Procesando
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline">
          <Clock className="h-3 w-3 mr-1" />
          Pendiente
        </Badge>
      );
    case "error":
      return (
        <Badge variant="destructive">
          <AlertCircle className="h-3 w-3 mr-1" />
          Error
        </Badge>
      );
  }
}

export default function AssetsPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: assets = [], isLoading } = useQuery<PreparedAsset[]>({
    queryKey: ["/api/assets"],
    refetchInterval: 5000,
  });

  const form = useForm({
    resolver: zodResolver(createAssetSchema),
    defaultValues: {
      title: "",
      sourceUrl: "",
      segmentDuration: 4,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: z.infer<typeof createAssetSchema>) =>
      apiRequest("POST", "/api/assets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setDialogOpen(false);
      form.reset();
      toast({
        title: "Video añadido",
        description: "El video se está procesando en segundo plano.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear el asset.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/assets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Asset eliminado",
        description: "El video segmentado ha sido eliminado.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el asset.",
        variant: "destructive",
      });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/assets/${id}/retry`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({
        title: "Reintentando",
        description: "El procesamiento se ha reiniciado.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo reintentar el procesamiento.",
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/assets/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({
        title: "Cancelado",
        description: "El procesamiento ha sido cancelado.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo cancelar el procesamiento.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof createAssetSchema>) => {
    createMutation.mutate(data);
  };

  const totalSize = assets.reduce((sum, a) => sum + a.totalSize, 0);
  const readyAssets = assets.filter(a => a.status === "ready").length;
  const processingAssets = assets.filter(a => a.status === "processing").length;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Videos Pre-Segmentados</h1>
          <p className="text-muted-foreground">
            Procesa videos para usarlos sin buffering en los canales
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-asset">
              <Plus className="h-4 w-4 mr-2" />
              Añadir Video
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Añadir Video para Segmentar</DialogTitle>
              <DialogDescription>
                Introduce la URL del video para pre-procesarlo en segmentos HLS.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Nombre del video" 
                          {...field} 
                          data-testid="input-asset-title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sourceUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL del Video</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://..." 
                          {...field}
                          data-testid="input-asset-url"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="segmentDuration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duración de Segmento (segundos)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          min={2}
                          max={10}
                          {...field}
                          onChange={e => field.onChange(parseInt(e.target.value) || 4)}
                          data-testid="input-asset-segment-duration"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-asset">
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Añadiendo...
                      </>
                    ) : (
                      "Añadir y Procesar"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Film className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-semibold" data-testid="text-ready-assets">{readyAssets}</p>
                <p className="text-sm text-muted-foreground">Videos Listos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-yellow-500/10">
                <Loader2 className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold" data-testid="text-processing-assets">{processingAssets}</p>
                <p className="text-sm text-muted-foreground">En Proceso</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-500/10">
                <HardDrive className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold" data-testid="text-total-size">{formatBytes(totalSize)}</p>
                <p className="text-sm text-muted-foreground">Espacio Usado</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : assets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Film className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay videos segmentados</h3>
            <p className="text-muted-foreground text-center mb-4">
              Añade videos para pre-procesarlos y usarlos sin buffering.
            </p>
            <Button onClick={() => setDialogOpen(true)} data-testid="button-add-first-asset">
              <Plus className="h-4 w-4 mr-2" />
              Añadir Primer Video
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {assets.map((asset) => (
            <Card key={asset.id} data-testid={`card-asset-${asset.id}`}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-medium truncate">{asset.title}</h3>
                      {getStatusBadge(asset.status)}
                    </div>
                    <p className="text-sm text-muted-foreground truncate mb-3">
                      {asset.sourceUrl}
                    </p>
                    {asset.status === "ready" && (
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatDuration(asset.duration)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Film className="h-4 w-4" />
                          {asset.segmentCount} segmentos
                        </span>
                        <span className="flex items-center gap-1">
                          <HardDrive className="h-4 w-4" />
                          {formatBytes(asset.totalSize)}
                        </span>
                      </div>
                    )}
                    {asset.status === "error" && asset.errorMessage && (
                      <p className="text-sm text-destructive mt-2">
                        {asset.errorMessage}
                      </p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-asset-menu-${asset.id}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {asset.status === "error" && (
                        <DropdownMenuItem 
                          onClick={() => retryMutation.mutate(asset.id)}
                          data-testid={`button-retry-asset-${asset.id}`}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Reintentar
                        </DropdownMenuItem>
                      )}
                      {asset.status === "processing" && (
                        <DropdownMenuItem 
                          onClick={() => cancelMutation.mutate(asset.id)}
                          data-testid={`button-cancel-asset-${asset.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancelar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem 
                        className="text-destructive focus:text-destructive"
                        onClick={() => deleteMutation.mutate(asset.id)}
                        data-testid={`button-delete-asset-${asset.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
