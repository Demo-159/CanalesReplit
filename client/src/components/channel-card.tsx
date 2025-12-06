import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Pause, Film, Clock, Copy, ExternalLink, MoreVertical, Trash2, Edit } from "lucide-react";
import { Link } from "wouter";
import type { Channel } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface ChannelCardProps {
  channel: Channel;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (channel: Channel) => void;
  isStarting?: boolean;
  isStopping?: boolean;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function ChannelCard({ 
  channel, 
  onStart, 
  onStop, 
  onDelete,
  onEdit,
  isStarting,
  isStopping 
}: ChannelCardProps) {
  const { toast } = useToast();
  
  const totalDuration = channel.videos.reduce((acc, v) => acc + v.duration, 0);
  const m3u8Url = `${window.location.origin}/streams/${channel.id}/playlist.m3u8`;

  const copyM3u8 = () => {
    navigator.clipboard.writeText(m3u8Url);
    toast({
      title: "Enlace copiado",
      description: "El enlace .m3u8 ha sido copiado al portapapeles",
    });
  };

  const getStatusBadge = () => {
    switch (channel.status) {
      case "live":
        return (
          <Badge variant="default" className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30">
            <span className="relative flex h-2 w-2 mr-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            En Vivo
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            Inactivo
          </Badge>
        );
    }
  };

  return (
    <Card className="group relative" data-testid={`card-channel-${channel.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base font-semibold truncate">
              {channel.name}
            </CardTitle>
            {getStatusBadge()}
          </div>
          {channel.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
              {channel.description}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              data-testid={`button-channel-menu-${channel.id}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(channel)} data-testid={`button-edit-channel-${channel.id}`}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={copyM3u8} data-testid={`button-copy-m3u8-${channel.id}`}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar .m3u8
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(channel.id)}
              data-testid={`button-delete-channel-${channel.id}`}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Film className="h-4 w-4" />
            <span>{channel.videos.length} videos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            <span>{formatDuration(totalDuration)}</span>
          </div>
        </div>

        {channel.status === "live" && (
          <div className="p-3 rounded-md bg-muted/50 border">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <code className="text-xs font-mono text-muted-foreground truncate flex-1">
                {m3u8Url}
              </code>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={copyM3u8}
                data-testid={`button-copy-inline-${channel.id}`}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {channel.status === "live" ? (
            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => onStop(channel.id)}
              disabled={isStopping}
              data-testid={`button-stop-channel-${channel.id}`}
            >
              <Pause className="h-4 w-4 mr-1.5" />
              {isStopping ? "Deteniendo..." : "Detener"}
            </Button>
          ) : (
            <Button 
              variant="default" 
              size="sm"
              onClick={() => onStart(channel.id)}
              disabled={isStarting || channel.videos.length === 0}
              data-testid={`button-start-channel-${channel.id}`}
            >
              <Play className="h-4 w-4 mr-1.5" />
              {isStarting ? "Iniciando..." : "Iniciar"}
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/channels/${channel.id}`} data-testid={`link-channel-detail-${channel.id}`}>
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Ver Detalle
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
