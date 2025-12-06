import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, FileText } from "lucide-react";
import { useState } from "react";

interface EpgUrlDisplayProps {
  channelId: string;
}

export function EpgUrlDisplay({ channelId }: EpgUrlDisplayProps) {
  const [copied, setCopied] = useState(false);
  const epgUrl = `${window.location.origin}/api/channels/${channelId}/epg.xml`;

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(epgUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card data-testid="card-epg-display">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">EPG (Guía de Programación)</CardTitle>
        <CardDescription>
          URL del archivo XML compatible con reproductores IPTV.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-md border bg-muted/50">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              URL EPG XML
            </span>
          </div>
          <code className="text-sm font-mono break-all block" data-testid="text-epg-url">
            {epgUrl}
          </code>
        </div>
        
        <Button 
          variant="outline" 
          className="w-full"
          onClick={copyToClipboard}
          data-testid="button-copy-epg"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copiar URL
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
