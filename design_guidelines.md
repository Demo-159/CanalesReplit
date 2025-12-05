# Design Guidelines: 24/7 Loop Channel Management Panel

## Design Approach

**System-Based Approach**: Modern dashboard design inspired by Vercel, Railway, and Linear - clean, functional, data-focused with excellent information hierarchy.

**Rationale**: This is a utility-focused admin panel prioritizing efficiency, real-time data display, and task completion over visual storytelling.

---

## Core Design Elements

### Typography
- **Primary Font**: Inter (Google Fonts CDN)
- **Mono Font**: JetBrains Mono for .m3u8 URLs and technical data
- **Hierarchy**:
  - Page titles: text-2xl/text-3xl, font-semibold
  - Section headers: text-lg, font-medium
  - Channel names: text-base, font-medium
  - Body text: text-sm
  - Technical data (URLs, status): text-xs, mono

### Layout System
**Spacing Units**: Tailwind 2, 4, 6, 8, 12, 16 for consistent rhythm
- Component padding: p-4 to p-6
- Section gaps: gap-6 to gap-8
- Card spacing: space-y-4
- Button padding: px-4 py-2

### Component Library

**Dashboard Structure**:
- Fixed sidebar (w-64) with navigation: Channels, Settings
- Main content area with responsive grid
- Top bar with search and user actions

**Channel Cards**:
- Grid layout: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
- Each card shows: Channel name, status badge (Live/Idle), video count, playlist duration
- Hover state reveals quick actions (Edit, View Playlist, Copy .m3u8)
- Live status indicator: animated pulsing dot

**Playlist Management Interface**:
- Drag-and-drop reorderable list
- Each video item displays: thumbnail placeholder, title, duration, delete action
- Add video section: URL input with validation feedback
- Total playlist duration summary at bottom

**.m3u8 Link Display**:
- Prominent card with monospace font
- One-click copy button with success feedback
- QR code for mobile testing
- Example integration code snippet (expandable)

**Forms & Inputs**:
- Floating labels for text inputs
- Clear validation states (error/success borders)
- Submit buttons with loading states
- Modal overlays for creating/editing channels

**Data Tables** (if showing detailed logs):
- Striped rows for readability
- Sortable columns
- Pagination controls at bottom

### Icons
**Library**: Heroicons (CDN)
- Play/Pause icons for channel status
- Plus icon for adding videos/channels
- Trash for deletions
- Copy icon for .m3u8 URLs
- Drag handle for reordering

### Interactions
- Smooth transitions (transition-all duration-200)
- Button hover: subtle scale (hover:scale-105)
- Loading spinners for async operations
- Toast notifications for success/error messages (top-right)
- Confirmation modals for destructive actions

---

## Page-Specific Layouts

**Main Dashboard**:
- Stats overview row: Total channels, Active streams, Total videos
- Channel grid below with search/filter controls
- Empty state with prominent "Create First Channel" CTA

**Channel Detail Page**:
- Split layout: Left (2/3) - Playlist manager, Right (1/3) - Channel info & .m3u8 link
- Sticky .m3u8 link card on scroll
- Video preview player at top (optional)

**Create/Edit Channel Modal**:
- Centered overlay (max-w-2xl)
- Form fields: Name, Description
- Footer with Cancel/Save actions

---

## Accessibility
- Consistent focus states (ring-2 ring-offset-2)
- ARIA labels for icon-only buttons
- Keyboard navigation for playlist reordering (arrow keys)
- Screen reader announcements for status changes

---

## Images
**No hero images required** - this is a functional dashboard. Use:
- Placeholder thumbnails for video items (16:9 aspect ratio, bg-gray-200)
- Icon illustrations for empty states
- Channel preview thumbnails (optional, user-uploaded)