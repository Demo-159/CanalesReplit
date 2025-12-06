import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertVideoSchema, type InsertVideo } from "@shared/schema";
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
import { Button } from "@/components/ui/button";
import { Link2, Film } from "lucide-react";

interface AddVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InsertVideo) => void;
  isPending?: boolean;
}

export function AddVideoDialog({ 
  open, 
  onOpenChange, 
  onSubmit,
  isPending 
}: AddVideoDialogProps) {
  const form = useForm<InsertVideo>({
    resolver: zodResolver(insertVideoSchema),
    defaultValues: {
      url: "",
      title: "",
      duration: 0,
    },
  });

  const handleSubmit = (data: InsertVideo) => {
    onSubmit(data);
    form.reset();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" />
            Añadir Video
          </DialogTitle>
          <DialogDescription>
            Añade un video a la playlist del canal. El video se reproducirá en loop junto con los demás.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL del Video</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="https://ejemplo.com/video.mp4" 
                        className="pl-9"
                        {...field} 
                        data-testid="input-video-url"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Soporta URLs directas a archivos de video (MP4, WebM, etc.)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título del Video</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Nombre descriptivo del video" 
                      {...field} 
                      data-testid="input-video-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duración (segundos)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      placeholder="120" 
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      data-testid="input-video-duration"
                    />
                  </FormControl>
                  <FormDescription>
                    Duración aproximada del video en segundos.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => handleOpenChange(false)}
                data-testid="button-cancel-video"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isPending}
                data-testid="button-submit-video"
              >
                {isPending ? "Añadiendo..." : "Añadir Video"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
