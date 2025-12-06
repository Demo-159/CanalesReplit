import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { streamingConfigSchema, type StreamingConfig } from "@shared/schema";

interface StreamingConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  currentConfig: StreamingConfig;
}

const presetDescriptions: Record<string, string> = {
  ultrafast: "Mínimo uso de CPU, menor calidad",
  superfast: "Muy bajo uso de CPU",
  veryfast: "Bajo uso de CPU (recomendado)",
  faster: "Uso moderado de CPU",
  fast: "Mayor uso de CPU, mejor calidad",
};

export function StreamingConfigDialog({ open, onOpenChange, channelId, currentConfig }: StreamingConfigDialogProps) {
  const { toast } = useToast();
  
  const form = useForm({
    resolver: zodResolver(streamingConfigSchema),
    defaultValues: currentConfig,
  });

  const mutation = useMutation({
    mutationFn: (data: StreamingConfig) =>
      apiRequest("PATCH", `/api/channels/${channelId}/config`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels", channelId] });
      onOpenChange(false);
      toast({
        title: "Configuración guardada",
        description: "Los cambios se aplicarán cuando reinicies el canal.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuración de Streaming</DialogTitle>
          <DialogDescription>
            Ajusta estos parámetros para optimizar el rendimiento y reducir el consumo de recursos.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
            <FormField
              control={form.control}
              name="preset"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Velocidad de Codificación</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-preset">
                        <SelectValue placeholder="Selecciona un preset" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(presetDescriptions).map(([value, desc]) => (
                        <SelectItem key={value} value={value}>
                          {value} - {desc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Presets más rápidos usan menos CPU pero generan archivos más grandes
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="videoBitrate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bitrate de Video: {field.value} kbps</FormLabel>
                  <FormControl>
                    <Slider
                      min={200}
                      max={4000}
                      step={100}
                      value={[field.value]}
                      onValueChange={([value]) => field.onChange(value)}
                      data-testid="slider-video-bitrate"
                    />
                  </FormControl>
                  <FormDescription>
                    Menor bitrate = menos recursos y ancho de banda
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="audioBitrate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bitrate de Audio: {field.value} kbps</FormLabel>
                  <FormControl>
                    <Slider
                      min={32}
                      max={256}
                      step={16}
                      value={[field.value]}
                      onValueChange={([value]) => field.onChange(value)}
                      data-testid="slider-audio-bitrate"
                    />
                  </FormControl>
                  <FormDescription>
                    128 kbps es suficiente para la mayoría de casos
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="segmentDuration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duración de Segmentos: {field.value}s</FormLabel>
                  <FormControl>
                    <Slider
                      min={2}
                      max={10}
                      step={1}
                      value={[field.value]}
                      onValueChange={([value]) => field.onChange(value)}
                      data-testid="slider-segment-duration"
                    />
                  </FormControl>
                  <FormDescription>
                    Segmentos más largos = mejor estabilidad, más latencia
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="playlistSize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tamaño de Playlist: {field.value} segmentos</FormLabel>
                  <FormControl>
                    <Slider
                      min={3}
                      max={15}
                      step={1}
                      value={[field.value]}
                      onValueChange={([value]) => field.onChange(value)}
                      data-testid="slider-playlist-size"
                    />
                  </FormControl>
                  <FormDescription>
                    Más segmentos = mayor buffer, menos cortes
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="transitionDelay"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delay de Transición: {field.value}ms</FormLabel>
                  <FormControl>
                    <Slider
                      min={100}
                      max={2000}
                      step={100}
                      value={[field.value]}
                      onValueChange={([value]) => field.onChange(value)}
                      data-testid="slider-transition-delay"
                    />
                  </FormControl>
                  <FormDescription>
                    Tiempo entre videos para evitar cortes abruptos
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="threads"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hilos de CPU: {field.value}</FormLabel>
                  <FormControl>
                    <Slider
                      min={1}
                      max={4}
                      step={1}
                      value={[field.value]}
                      onValueChange={([value]) => field.onChange(value)}
                      data-testid="slider-threads"
                    />
                  </FormControl>
                  <FormDescription>
                    Más hilos = más rápido pero más uso de CPU
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-config"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={mutation.isPending}
                data-testid="button-save-config"
              >
                {mutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
