# WhereAmI — Android to Web Migration Plan Claude Sonnet 4.6

## 1. Technology Mapping (Android → Web)

| Android Component | Web Equivalent |
|---|---|
| Activity / XML Layouts | Single-page HTML + Bootstrap modals/panels |
| `LocationManager` (GPS) | `navigator.geolocation` (`getCurrentPosition` / `watchPosition`) |
| Device bearing | `DeviceOrientationEvent.alpha` / bearing derived from consecutive GPS points |
| Google Maps `MapView` + `MapController` | **Leaflet.js** (CDN) + **OpenStreetMap** tiles |
| `RouteOverlay` canvas drawing | **Leaflet Polyline** + custom **HTML5 Canvas** arrow drawing |
| Android `Geocoder` (place → lat/lng) | **OpenStreetMap Nominatim** REST API |
| Google Elevation XML API | **Open-Meteo Elevation** API (free, no API key required) |
| `SharedPreferences` | `localStorage` |
| `BearingFrameLayout` (map rotation) | CSS `transform: rotate()` on the Leaflet map container |
| `AlertDialog` | Bootstrap modal |
| `ontrack.png` tiled background | Same PNG, CSS `background-repeat: repeat` |
| `HelpActivity` (assets/readme.htm) | In-page Bootstrap modal |
| Menu (Settings, Help) | Bootstrap navbar / hamburger icon |
| Red finish flag bitmap | Leaflet `DivIcon` using finish flag PNG from Android assets |

---

## 2. Application Architecture

The web app is a **single-page application (SPA)** using plain HTML / Bootstrap / plain JavaScript — no build tools required. It opens directly in a browser as a local file or via any simple static server. All views are Bootstrap `<div>` sections toggled with `display: none / block`, mimicking Android's activity back-stack.

### File structure in `web/`

```
web/
├── index.html          ← main entry point (home screen = WhereAmI activity)
├── js/
│   ├── app.js          ← navigation and shared init
│   ├── settings.js     ← Settings module (localStorage)
│   ├── map.js          ← Leaflet map wrapper, tile switching
│   ├── gps.js          ← GPS fixes, best-fix logic
│   ├── whereami.js     ← "Where am I?" feature
│   ├── direction.js    ← "Show Direction" feature + bearing rotation
│   ├── mark.js         ← Mark here / Mark on place / Remove mark
│   ├── geocode.js      ← Nominatim geocoding
│   ├── elevation.js    ← Open-Meteo elevation API
│   └── arrows.js       ← Canvas/Leaflet arrow drawing on route
├── css/
│   └── app.css         ← minimal overrides (background tile, colors)
├── assets/
│   ├── ontrack.png     ← copied from Android drawable (tiled background)
│   └── finish_flag.png ← copied from Android res/drawable
└── README.md
```

---

## 3. Color Scheme & Branding

Matching the Android UI exactly:
- **Background**: `ontrack.png` tiled (`background: url(assets/ontrack.png) repeat`)
- **Primary / button color**: `#FF0000` (red) for all text, buttons, route lines, GPS info
- **Button style**: Bootstrap `btn` with `color:#FF0000; border-color:#FF0000` (custom class `btn-whereami`)
- **Title text**: "Where am I?" — red, bold, italic, text-shadow

---

## 4. Step-by-Step Migration Plan

Each step leaves the app in a **fully runnable state**.

---

### Step 1 — Home Screen (static skeleton)
**Delivers**: A pixel-comparable home screen openable in a browser.

- `index.html` with Bootstrap 5 (CDN)
- Tiled `ontrack.png` background
- App title "Where am I?" (red, bold, italic, shadow)
- Three full-width buttons: **"Where am I?"**, **"I am lost – Show direction!"**, **"Set Mark"**
- Navbar with Settings icon and Help icon
- `app.js` — view-switching skeleton (show/hide sections)
- `settings.js` — loads/saves to `localStorage`, all defaults matching Android

---

### Step 2 — Settings Screen
**Delivers**: Working settings page that persists across page reloads.

Controls matching `SettingsActivity.java`:
- `Units: Foot and mile` checkbox
- `Get altitude using web service` checkbox
- `Show GPS output` (for Where am I?) checkbox
- `Show GPS output` (for Show Direction) checkbox
- `Number of fixes for best GPS fix` selector (options: 1, 2, 3, 5, 10)
- Save button + back-without-saving confirmation (Bootstrap modal)
- Back button / nav returns to home

---

### Step 3 — Map Integration (Leaflet + OSM)
**Delivers**: Pan/zoom map with map/satellite toggle.

- Leaflet.js and OpenStreetMap tiles loaded via CDN
- Map view section replaces the Android `MapActivity`
- Map/Satellite menu item: OSM standard tiles ↔ Esri World Imagery tiles
- `map.js` initialises Leaflet map, zoom level 18 (matching Android `MAP_ZOOM = 18`)
- Back button returns to home screen

---

### Step 4 — "Where am I?" Feature
**Delivers**: Full Where am I? feature end-to-end.

- `gps.js`: `getCurrentPosition` with high-accuracy, collects N fixes (per settings), best-fix algorithm (lowest `accuracy` value) — matches `RouteOverlay.bestfix()`
- `whereami.js`: starts GPS, waits for N fixes, centres map, places red cross `DivIcon` marker
- `elevation.js`: fetches altitude from Open-Meteo Elevation API when setting is enabled (replaces `ElevationFromGoogleMaps`)
- GPS info text panel (lat, lng, accuracy, altitude, fix count, timestamp)
- If mark exists: draws dashed red crow-path polyline from current position → mark (matches `MARK_ROUTE` overlay)
- "Where am I?" button visible on map screen, re-runs acquisition

---

### Step 5 — "I am Lost – Show Direction!" Feature
**Delivers**: Full direction-tracking feature.

- `direction.js`: uses `watchPosition` for continuous GPS updates
- Start/Stop toggle button (matches `directionToggleButton`, red text)
- Route line drawn as red Leaflet polyline
- `arrows.js`: arrow heads drawn at intervals along the route using HTML5 Canvas overlay — no external library (matches `RouteOverlay` arrowhead drawing, requirement §12)
- Map rotates to face direction of travel: CSS `transform: rotate(-bearingDeg)` on Leaflet container (matches `BearingFrameLayout`)
- GPS info panel updates in real-time; if mark is set, shows live distance-to-mark

---

### Step 6 — Mark Feature
**Delivers**: All mark functionality (mark here, mark on place, remove, crow-path).

- `mark.js`:
  - **"Mark here"** → GPS fix → saves lat/lng/date to `localStorage`
  - **"Mark on another place"** → text input dialog → `geocode.js` calls Nominatim → map re-centres, draggable red circle to confirm position, Save button
  - **Remove mark** → confirmation dialog → clears `localStorage` mark entry
- Mark button label: "Set Mark" / "Mark [MonDD HH:mm]" (matches Android `formatter_mark`)
- Finish flag `DivIcon` on map at mark position
- Crow-path (dashed red arrow polyline) from current position to mark in both Where and Direction views

---

### Step 7 — Help Screen
**Delivers**: Help content accessible from the navbar Help icon.

- Bootstrap modal or dedicated panel
- Content adapted from `android/src/whereami/WhereamI/assets/readme.htm`

---

### Step 8 — Polish & README
**Delivers**: Production-ready web app.

- Responsive review: tested at mobile portrait (375 px), tablet, desktop
- `aria-label` attributes on all buttons/inputs for accessibility (requirement §14)
- Cross-browser checks: Chrome, Firefox, Safari, Edge
- Code comments and JSDoc headers on all modules (requirement §16)
- `web/README.md`: app description, feature list, how to run (open `index.html` or use any static server), GPS permission note for browsers

---

## 5. Key Technical Decisions

- **Leaflet.js**: Lightweight open-source mapping library — not a "graph library" as excluded by requirement §12. Standard pairing for OpenStreetMap.
- **Bearing / map rotation**: `BearingFrameLayout` rotates the Android map canvas. On the web this is achieved with CSS `transform: rotate()` on the Leaflet container `div`. The route overlay is drawn in a fixed coordinate system, unaffected by the visual rotation.
- **Best-fix algorithm**: Directly portable from `RouteOverlay.bestfix()` — collect N `Position` objects, return the one with minimum `accuracy` value.
- **Nominatim rate limit**: Requires a `User-Agent` header; allows one request per second for public use — sufficient for single interactive use.
- **Open-Meteo Elevation API**: `https://api.open-meteo.com/v1/elevation?latitude=X&longitude=Y` — free, CORS-enabled, no API key.
- **No CORS issues**: All external APIs (Nominatim, Open-Meteo, OSM tiles, Esri tiles) support browser CORS requests.
- **No build tools**: The entire app opens as a static file — no npm, no bundler, matching requirement §2 (plain JavaScript).
