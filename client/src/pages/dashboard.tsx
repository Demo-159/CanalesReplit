import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Radio, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatsCards } from "@/components/stats-cards";
import { ChannelCard } from "@/components/channel-card";
import { ChannelDialog } from "@/components/channel-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Channel, ChannelStats, InsertChannel } from "@shared/schema";
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

export default function Dashboard() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [deleteChannelId, setDeleteChannelId] = useState<string | null>(null);
  const [actionChannelId, setActionChannelId] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<ChannelStats>({
    queryKey: ["/api/stats"],
  });

  const { data: channels = [], isLoading: channelsLoading } = useQuery<Channel[]>({
    queryKey: ["/api/channels"],
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertChannel) => apiRequest("POST", "/api/channels", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setDialogOpen(false);
      toast({
        title: "Canal creado",
        description: "El canal ha sido creado exitosamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear el canal.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InsertChannel }) =>
      apiRequest("PATCH", `/api/channels/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      setDialogOpen(false);
      setEditingChannel(null);
      toast({
        title: "Canal actualizado",
        description: "Los cambios han sido guardados.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el canal.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/channels/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setDeleteChannelId(null);
      toast({
        title: "Canal eliminado",
        description: "El canal ha sido eliminado.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el canal.",
        variant: "destructive",
      });
    },
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/channels/${id}/start`),
    onMutate: (id) => setActionChannelId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
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
    onSettled: () => setActionChannelId(null),
  });

  const stopMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/channels/${id}/stop`),
    onMutate: (id) => setActionChannelId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
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
    onSettled: () => setActionChannelId(null),
  });

  const filteredChannels = channels.filter(
    (channel) =>
      channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      channel.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = (data: InsertChannel) => {
    if (editingChannel) {
      updateMutation.mutate({ id: editingChannel.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (channel: Channel) => {
    setEditingChannel(channel);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingChannel(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">
            Gestiona tus canales de streaming 24/7
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="button-create-channel">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Canal
        </Button>
      </div>

      <StatsCards stats={stats} isLoading={statsLoading} />

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-medium">Canales</h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar canales..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-channels"
            />
          </div>
        </div>

        {channelsLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 rounded-lg border bg-card animate-pulse"
              />
            ))}
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Radio className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-1">
              {searchQuery ? "No se encontraron canales" : "Sin canales"}
            </h3>
            <p className="text-muted-foreground mb-4 max-w-sm">
              {searchQuery
                ? "Intenta con otra búsqueda."
                : "Crea tu primer canal para comenzar a transmitir contenido en loop 24/7."}
            </p>
            {!searchQuery && (
              <Button onClick={() => setDialogOpen(true)} data-testid="button-create-first-channel">
                <Plus className="h-4 w-4 mr-2" />
                Crear Primer Canal
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredChannels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                onStart={(id) => startMutation.mutate(id)}
                onStop={(id) => stopMutation.mutate(id)}
                onDelete={(id) => setDeleteChannelId(id)}
                onEdit={handleEdit}
                isStarting={startMutation.isPending && actionChannelId === channel.id}
                isStopping={stopMutation.isPending && actionChannelId === channel.id}
              />
            ))}
          </div>
        )}
      </div>

      <ChannelDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        onSubmit={handleSubmit}
        channel={editingChannel}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog open={!!deleteChannelId} onOpenChange={() => setDeleteChannelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar canal?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el canal y todo su contenido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteChannelId && deleteMutation.mutate(deleteChannelId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
