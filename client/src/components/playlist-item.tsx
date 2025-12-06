import { Trash2, Clock, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Video } from "@shared/schema";

interface PlaylistItemProps {
  video: Video;
  index: number;
  onDelete: (id: string) => void;
  isDragging?: boolean;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function PlaylistItem({ video, index, onDelete, isDragging }: PlaylistItemProps) {
  return (
    <div 
      className={`group flex items-center gap-3 p-3 rounded-md border bg-card transition-all ${
        isDragging ? 'shadow-lg ring-2 ring-primary/20' : 'hover-elevate'
      }`}
      data-testid={`playlist-item-${video.id}`}
    >
      <div className="flex items-center justify-center w-6 h-6 rounded bg-muted text-xs font-mono text-muted-foreground">
        {index + 1}
      </div>
      
      <div className="flex-shrink-0 w-16 h-10 rounded bg-muted flex items-center justify-center">
        <Link2 className="h-4 w-4 text-muted-foreground" />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{video.title}</p>
        <p className="text-xs text-muted-foreground truncate">{video.url}</p>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatDuration(video.duration)}</span>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
          onClick={() => onDelete(video.id)}
          data-testid={`button-delete-video-${video.id}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
