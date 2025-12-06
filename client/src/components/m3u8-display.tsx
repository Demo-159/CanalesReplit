import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Check, Radio } from "lucide-react";
import { useState } from "react";
import type { Channel } from "@shared/schema";

interface M3u8DisplayProps {
  channel: Channel;
}

export function M3u8Display({ channel }: M3u8DisplayProps) {
  const [copied, setCopied] = useState(false);
  const m3u8Url = `${window.location.origin}/streams/${channel.id}/playlist.m3u8`;

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(m3u8Url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isLive = channel.status === "live";

  return (
    <Card className="sticky top-4" data-testid="card-m3u8-display">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg">Enlace de Streaming</CardTitle>
          {isLive ? (
            <Badge variant="default" className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30">
              <span className="relative flex h-2 w-2 mr-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              En Vivo
            </Badge>
          ) : (
            <Badge variant="secondary">Inactivo</Badge>
          )}
        </div>
        <CardDescription>
          {isLive 
            ? "Tu canal está transmitiendo. Usa este enlace en cualquier reproductor compatible con HLS."
            : "Inicia el canal para activar el enlace de streaming."
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`p-4 rounded-md border ${isLive ? 'bg-muted/50' : 'bg-muted/20 opacity-60'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Radio className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              URL .m3u8
            </span>
          </div>
          <code className="text-sm font-mono break-all block" data-testid="text-m3u8-url">
            {m3u8Url}
          </code>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="default" 
            className="flex-1"
            onClick={copyToClipboard}
            disabled={!isLive}
            data-testid="button-copy-m3u8"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copiar Enlace
              </>
            )}
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            disabled={!isLive}
            onClick={() => window.open(m3u8Url, '_blank')}
            data-testid="button-open-m3u8"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>

        {isLive && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Ejemplo de uso:</p>
            <div className="p-3 rounded bg-muted/50 overflow-x-auto">
              <pre className="text-xs font-mono">
{`<video controls>
  <source src="${m3u8Url}" 
          type="application/vnd.apple.mpegurl">
</video>`}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
