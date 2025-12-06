import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Radio, Play, Film } from "lucide-react";
import type { ChannelStats } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

interface StatsCardsProps {
  stats: ChannelStats | undefined;
  isLoading: boolean;
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  const items = [
    {
      title: "Total Canales",
      value: stats?.totalChannels ?? 0,
      icon: Radio,
      description: "Canales configurados",
    },
    {
      title: "En Vivo",
      value: stats?.activeStreams ?? 0,
      icon: Play,
      description: "Transmitiendo ahora",
    },
    {
      title: "Videos",
      value: stats?.totalVideos ?? 0,
      icon: Film,
      description: "Videos en playlists",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item) => (
        <Card key={item.title} data-testid={`card-stat-${item.title.toLowerCase().replace(/\s/g, '-')}`}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {item.title}
            </CardTitle>
            <item.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{item.value}</div>
            <p className="text-xs text-muted-foreground">{item.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
