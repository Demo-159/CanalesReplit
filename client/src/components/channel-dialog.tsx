import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertChannelSchema, type InsertChannel, type Channel } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

interface ChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InsertChannel) => void;
  channel?: Channel | null;
  isPending?: boolean;
}

export function ChannelDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  channel,
  isPending 
}: ChannelDialogProps) {
  const isEditing = !!channel;
  
  const form = useForm<InsertChannel>({
    resolver: zodResolver(insertChannelSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (channel) {
        form.reset({
          name: channel.name,
          description: channel.description,
        });
      } else {
        form.reset({
          name: "",
          description: "",
        });
      }
    }
  }, [open, channel, form]);

  const handleSubmit = (data: InsertChannel) => {
    onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Canal" : "Crear Nuevo Canal"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Modifica los detalles del canal." 
              : "Configura un nuevo canal de streaming 24/7 en loop."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Canal</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Mi Canal 24/7" 
                      {...field} 
                      data-testid="input-channel-name"
                    />
                  </FormControl>
                  <FormDescription>
                    Un nombre descriptivo para identificar tu canal.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe el contenido de este canal..." 
                      className="resize-none"
                      {...field} 
                      data-testid="input-channel-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-channel"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isPending}
                data-testid="button-submit-channel"
              >
                {isPending 
                  ? (isEditing ? "Guardando..." : "Creando...") 
                  : (isEditing ? "Guardar Cambios" : "Crear Canal")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
