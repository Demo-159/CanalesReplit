import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Plus, Play, Pause, Clock, Film, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PlaylistItem } from "@/components/playlist-item";
import { AddVideoDialog } from "@/components/add-video-dialog";
import { M3u8Display } from "@/components/m3u8-display";
import { EpgUrlDisplay } from "@/components/epg-url-display";
import { StreamingConfigDialog } from "@/components/streaming-config-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Channel, InsertVideo } from "@shared/schema";
import { Link } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export default function ChannelDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [addVideoOpen, setAddVideoOpen] = useState(false);
  const [deleteVideoId, setDeleteVideoId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  const { data: channel, isLoading, error } = useQuery<Channel>({
    queryKey: ["/api/channels", id],
    enabled: !!id,
  });

  const addVideoMutation = useMutation({
    mutationFn: (data: InsertVideo) =>
      apiRequest("POST", `/api/channels/${id}/videos`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setAddVideoOpen(false);
      toast({
        title: "Video añadido",
        description: "El video ha sido añadido a la playlist.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo añadir el video.",
        variant: "destructive",
      });
    },
  });

  const deleteVideoMutation = useMutation({
    mutationFn: (videoId: string) =>
      apiRequest("DELETE", `/api/channels/${id}/videos/${videoId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setDeleteVideoId(null);
      toast({
        title: "Video eliminado",
        description: "El video ha sido eliminado de la playlist.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el video.",
        variant: "destructive",
      });
    },
  });

  const startMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/channels/${id}/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Canal iniciado",
        description: "El streaming ha comenzado.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo iniciar el canal.",
        variant: "destructive",
      });
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/channels/${id}/stop`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Canal detenido",
        description: "El streaming ha sido detenido.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo detener el canal.",
        variant: "destructive",
      });
    },
  });

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh]">
        <h2 className="text-xl font-semibold mb-2">Canal no encontrado</h2>
        <p className="text-muted-foreground mb-4">
          El canal que buscas no existe o ha sido eliminado.
        </p>
        <Button variant="outline" asChild>
          <Link href="/" data-testid="link-back-to-dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al Dashboard
          </Link>
        </Button>
      </div>
    );
  }

  if (isLoading || !channel) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-64 w-full" />
          </div>
          <div>
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const totalDuration = channel.videos.reduce((acc, v) => acc + v.duration, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold">{channel.name}</h1>
          </div>
          {channel.description && (
            <p className="text-muted-foreground ml-11">{channel.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setConfigOpen(true)}
            data-testid="button-open-config"
          >
            <Settings className="h-4 w-4" />
          </Button>
          {channel.status === "live" ? (
            <Button
              variant="secondary"
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
              data-testid="button-stop-channel"
            >
              <Pause className="h-4 w-4 mr-2" />
              {stopMutation.isPending ? "Deteniendo..." : "Detener"}
            </Button>
          ) : (
            <Button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending || channel.videos.length === 0}
              data-testid="button-start-channel"
            >
              <Play className="h-4 w-4 mr-2" />
              {startMutation.isPending ? "Iniciando..." : "Iniciar Canal"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-lg">Playlist</CardTitle>
              <Button size="sm" onClick={() => setAddVideoOpen(true)} data-testid="button-add-video">
                <Plus className="h-4 w-4 mr-1.5" />
                Añadir Video
              </Button>
            </CardHeader>
            <CardContent>
              {channel.videos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-4 mb-4">
                    <Film className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-1">Playlist vacía</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                    Añade videos a la playlist para comenzar a transmitir en loop.
                  </p>
                  <Button onClick={() => setAddVideoOpen(true)} data-testid="button-add-first-video">
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir Primer Video
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {channel.videos.map((video, index) => (
                    <PlaylistItem
                      key={video.id}
                      video={video}
                      index={index}
                      onDelete={(videoId) => setDeleteVideoId(videoId)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {channel.videos.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Film className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        <span className="font-medium">{channel.videos.length}</span>{" "}
                        <span className="text-muted-foreground">videos</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        <span className="font-medium">{formatDuration(totalDuration)}</span>{" "}
                        <span className="text-muted-foreground">duración total</span>
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Se reproducirá en loop infinito
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <M3u8Display channel={channel} />
          <EpgUrlDisplay channelId={id || ""} />
        </div>
      </div>

      <AddVideoDialog
        open={addVideoOpen}
        onOpenChange={setAddVideoOpen}
        onSubmit={(data) => addVideoMutation.mutate(data)}
        isPending={addVideoMutation.isPending}
      />

      <AlertDialog open={!!deleteVideoId} onOpenChange={() => setDeleteVideoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar video?</AlertDialogTitle>
            <AlertDialogDescription>
              El video será eliminado de la playlist. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-video">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteVideoId && deleteVideoMutation.mutate(deleteVideoId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-video"
            >
              {deleteVideoMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <StreamingConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        channelId={id || ""}
        currentConfig={channel.streamingConfig}
      />
    </div>
  );
}
