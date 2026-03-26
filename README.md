# Where am I? — Web App

A web port of the [KjelleJ/WhereAmI](https://github.com/KjelleJ/WhereAmI) Android app.  
Find your location, track your direction, and set a landmark — all from your browser, no installation required.

---

## Features

| Feature | Description |
|---|---|
| **Where am I?** | Collects N GPS fixes, picks the most accurate one, and shows your position on an OpenStreetMap map with latitude, longitude, accuracy, and (optionally) elevation. |
| **I am lost – Show Direction!** | Continuous GPS tracking. The map rotates to face your direction of travel and draws your route as a red line. |
| **Set Mark** | Save a finish-flag landmark at your current GPS position or at any named place (geocoded via Nominatim). A dashed crow-path line is drawn from your current position to the mark in both map modes. |
| **Settings** | Choose metre/km vs. foot/mile, enable Web-Elevation API for more accurate altitude, control GPS info display, and set the number of fixes used for best-fix selection. |
| **Help** | Built-in help screen explaining all features. |
| **Map / Satellite toggle** | Switch between OpenStreetMap street tiles and Esri World Imagery satellite tiles. |

---

## How to Run

### Option A — Python (simplest)

```bash
cd web
py -m http.server 8080
```

Open <http://localhost:8080> in your browser.

### Option B — Any static file server

Serve the `web/` folder with any HTTP server (nginx, Apache, `npx serve`, etc.).  
The app is plain HTML + JS — no build step, no npm.

### Option C — Open directly (limited)

Double-click `web/index.html` to open as a `file://` URL.  
**Note:** GPS (`navigator.geolocation`) is blocked by most browsers on `file://` origins.  
Use one of the server options above for full functionality.

---

## GPS Permission

The app requires the **Location** permission in your browser.

- On first use the browser will show a permission prompt — click **Allow**.
- On **iOS Safari**: location is only available over HTTPS or `localhost`. Use the Python server or deploy to a secure host.
- **Accuracy tip**: use indoors or in an open area. The "Number of fixes" setting (default 3) helps filter noise — increase it for better accuracy at the cost of a longer wait.

---

## Browser Compatibility

| Browser | Status |
|---|---|
| Chrome (desktop + Android) | ✅ Full support |
| Firefox (desktop + Android) | ✅ Full support |
| Safari (macOS + iOS) | ✅ Full support (requires HTTPS or localhost) |
| Edge (desktop) | ✅ Full support |

The **Rotate to portrait** overlay is shown automatically on small screens in landscape orientation.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Maps | [Leaflet.js 1.9.4](https://leafletjs.com/) + [OpenStreetMap](https://www.openstreetmap.org/) tiles |
| Satellite tiles | [Esri World Imagery](https://www.arcgis.com/) (free, no API key) |
| Geocoding | [Nominatim](https://nominatim.openstreetmap.org/) (OpenStreetMap) |
| Elevation | [Open-Meteo Elevation API](https://open-meteo.com/) (free, no API key) |
| UI framework | [Bootstrap 5.3.3](https://getbootstrap.com/) + [Bootstrap Icons 1.11.3](https://icons.getbootstrap.com/) |
| JavaScript | Plain ES6 IIFEs — no build tools, no npm |
| Storage | `localStorage` (settings + mark persist across sessions) |

---

## File Structure

```
web/
├── index.html          ← Single-page app entry point
├── css/
│   └── app.css         ← App-specific styles (colours, layout overrides)
├── js/
│   ├── app.js          ← SPA navigation and home-screen logic
│   ├── settings.js     ← Settings persistence (localStorage)
│   ├── map.js          ← Leaflet map wrapper (tiles, markers, polylines, rotation)
│   ├── gps.js          ← GPS fix collection and best-fix selection
│   ├── elevation.js    ← Open-Meteo elevation API
│   ├── whereami.js     ← "Where am I?" feature orchestrator
│   ├── showdirection.js← "Show Direction" feature orchestrator
│   └── markhere.js     ← "Set Mark" feature (Mark here + Mark on place)
└── assets/
    ├── ontrack.png     ← Tiled background texture
    └── finish_flag.png ← Finish flag marker icon
```

---

## Notes

- **Nominatim usage policy**: the Nominatim geocoder is used for the "Mark on another place" feature. It is subject to the [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) — maximum one request per second for interactive use.
- **Mark persistence**: the mark position and timestamp are stored in `localStorage` and survive page reloads. Use the **Mark** button on the home screen to remove it.
- **No HTTPS required for localhost**: all modern browsers allow geolocation on `localhost` without HTTPS.

---

## Credits

Original Android app: [KjelleJ/WhereAmI](https://github.com/KjelleJ/WhereAmI) © GubboIT™ 2012–2013  
Web port: plain JS, Bootstrap, Leaflet, and OpenStreetMap.
