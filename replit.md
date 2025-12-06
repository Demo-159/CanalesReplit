# LoopStream - Panel de Canales 24/7

## Overview
Panel de administración web para gestionar canales de streaming 24/7 con playlists en loop y generación de enlaces .m3u8 en vivo.

## Architecture

### Frontend (React + TypeScript)
- **Framework**: React con Vite
- **Routing**: Wouter
- **State**: TanStack Query
- **UI**: Shadcn/ui + Tailwind CSS
- **Theme**: Dark/Light mode con ThemeProvider

### Backend (Express + TypeScript)
- **API**: REST endpoints en `/api/*`
- **Storage**: In-memory (MemStorage)
- **Streaming**: FFmpeg para generación de HLS

### Streaming System
- FFmpeg genera segmentos HLS (.ts) y playlist (.m3u8)
- Los streams se sirven desde `/streams/{channelId}/playlist.m3u8`
- Loop infinito usando `-stream_loop -1`
- Segmentos de 4 segundos con lista de 5

## Key Files

### Schema (`shared/schema.ts`)
- `Channel`: id, name, description, status, videos[], createdAt
- `Video`: id, url, title, duration, order
- `ChannelStats`: totalChannels, activeStreams, totalVideos

### API Endpoints
- `GET /api/stats` - Estadísticas globales
- `GET /api/channels` - Lista de canales
- `GET /api/channels/:id` - Detalle de canal
- `POST /api/channels` - Crear canal
- `PATCH /api/channels/:id` - Actualizar canal
- `DELETE /api/channels/:id` - Eliminar canal
- `POST /api/channels/:id/start` - Iniciar streaming
- `POST /api/channels/:id/stop` - Detener streaming
- `POST /api/channels/:id/videos` - Añadir video
- `DELETE /api/channels/:id/videos/:videoId` - Eliminar video

### Streaming
- `GET /streams/:channelId/playlist.m3u8` - Playlist HLS
- `GET /streams/:channelId/segment_XXX.ts` - Segmentos de video

## Development

### Running
```bash
npm run dev
```

### Requirements
- FFmpeg instalado en el sistema
- Node.js 20+

## Known Limitations
- **Streaming Gap**: There may be brief gaps (1-2 seconds) between videos in the playlist as FFmpeg transitions. This is due to the nature of HTTP streaming sources.
- **Remote URLs**: Videos are streamed directly from their source URLs. For seamless 24/7 streaming, consider using local video files or a dedicated streaming service.

## User Preferences
- Idioma de interfaz: Español
- Tema por defecto: Oscuro
