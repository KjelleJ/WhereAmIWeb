/**
 * map.js
 * Leaflet map wrapper for the WhereAmI web app.
 * Mirrors Android's MapTrack activity — map init, tile switching,
 * zoom level, markers, polylines, and bearing rotation.
 *
 * Tile sources:
 *   Map:       OpenStreetMap standard tiles
 *   Satellite: Esri World Imagery (free, no API key)
 */

const AppMap = (() => {

  // ── Constants matching Android MapTrack ──────────────────
  const MAP_ZOOM = 18;          // matches Android MAP_ZOOM = 18

  // ── Tile layer definitions ───────────────────────────────
  const TILE_LAYERS = {
    map: L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }
    ),
    satellite: L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      }
    ),
  };

  // ── Internal state ───────────────────────────────────────
  let _leafletMap   = null;   // Leaflet map instance
  let _currentTile  = 'map';  // 'map' | 'satellite'
  let _initialised  = false;

  // Overlays (populated by other modules in later steps)
  let _routePolyline   = null;  // red route line (ORD_ROUTE)
  let _markPolyline    = null;  // dashed crow-path to mark (MARK_ROUTE)
  let _posMarker       = null;  // current position marker (red cross)
  let _markMarker      = null;  // finish flag marker
  let _tapToMarkHandler = null; // Leaflet click listener for MARK_PLACE tap-to-place

  // Current bearing for map rotation (degrees, 0 = north)
  let _bearing = 0;

  // ── Public: initialise ───────────────────────────────────

  /**
   * Create (or re-use) the Leaflet map inside #leaflet-map.
   * Safe to call multiple times — only initialises once.
   */
  function init() {
    if (_initialised) {
      // Map already exists — just trigger a size recalculation
      // in case the container was hidden when first opened
      _leafletMap.invalidateSize();
      return;
    }

    _leafletMap = L.map('leaflet-map', {
      zoomControl: true,
      attributionControl: true,
    });

    // Start with OSM map tiles
    TILE_LAYERS.map.addTo(_leafletMap);
    _currentTile = 'map';

    // Default centre: Stockholm (same region as Android app screenshots)
    // Will be overridden as soon as GPS is available
    _leafletMap.setView([59.3293, 18.0686], MAP_ZOOM);

    _initialised = true;

    // Force Leaflet to recalculate its canvas size.
    // Needed because the div uses absolute positioning (oversized canvas).
    setTimeout(() => { _leafletMap.invalidateSize(); }, 50);
  }

  // ── Public: tile toggle ──────────────────────────────────

  /**
   * Toggle between OSM map and Esri satellite tiles.
   * Mirrors the Android Map/Satellite menu item.
   */
  function toggleTiles() {
    if (!_initialised) return;

    const btn = document.getElementById('btnToggleTiles');

    if (_currentTile === 'map') {
      _leafletMap.removeLayer(TILE_LAYERS.map);
      TILE_LAYERS.satellite.addTo(_leafletMap);
      _currentTile = 'satellite';
      if (btn) btn.title = 'Switch to map view';
    } else {
      _leafletMap.removeLayer(TILE_LAYERS.satellite);
      TILE_LAYERS.map.addTo(_leafletMap);
      _currentTile = 'map';
      if (btn) btn.title = 'Switch to satellite view';
    }
  }

  // ── Public: navigation ───────────────────────────────────

  /**
   * Handle the Back button in the map view.
   * Stops any active GPS tracking before returning home.
   */
  function handleBack() {
    App.showView('view-home');
  }

  // ── Public: map control helpers ──────────────────────────

  /**
   * Pan and zoom the map to a given lat/lng.
   * Mirrors Android's mapController.animateTo(point).
   * @param {number} lat
   * @param {number} lng
   * @param {number} [zoom]  defaults to MAP_ZOOM
   */
  function panTo(lat, lng, zoom) {
    if (!_initialised) return;
    _leafletMap.setView([lat, lng], zoom !== undefined ? zoom : MAP_ZOOM);
  }

  /**
   * Rotate the map container to face the direction of travel.
   * Mirrors Android's BearingFrameLayout.setBearing().
   * @param {number} degrees  0 = north, clockwise positive
   */
  function setBearing(degrees) {
    _bearing = degrees;
    const container = document.getElementById('leaflet-map');
    if (container) {
      container.style.transform = `rotate(${-degrees}deg)`;
    }
  }

  /**
   * Reset map rotation to north-up.
   */
  function resetBearing() {
    setBearing(0);
  }

  // ── Public: position marker ──────────────────────────────

  /**
   * Place or move the current-position marker (red cross).
   * Mirrors the red cross shown in Android's "Where am I" mode.
   * @param {number} lat
   * @param {number} lng
   */
  function setPositionMarker(lat, lng) {
    if (!_initialised) return;

    const icon = L.divIcon({
      className: '',
      html: '<div style="color:#FF0000;font-size:1.6rem;line-height:1;text-shadow:1px 1px 2px #000">✛</div>',
      iconAnchor: [12, 12],
    });

    if (_posMarker) {
      _posMarker.setLatLng([lat, lng]);
    } else {
      _posMarker = L.marker([lat, lng], { icon, interactive: false })
        .addTo(_leafletMap);
    }
  }

  /** Remove the position marker from the map. */
  function removePositionMarker() {
    if (_posMarker) {
      _leafletMap.removeLayer(_posMarker);
      _posMarker = null;
    }
  }

  // ── Public: mark (finish flag) marker ────────────────────

  /**
   * Place or move the finish-flag marker at the saved mark position.
   * @param {number} lat
   * @param {number} lng
   */
  function setMarkMarker(lat, lng) {
    if (!_initialised) return;

    const icon = L.divIcon({
      className: '',
      html: '<div style="font-size:1.8rem;line-height:1">🏁</div>',
      iconAnchor: [4, 20],
    });

    if (_markMarker) {
      _markMarker.setLatLng([lat, lng]);
    } else {
      _markMarker = L.marker([lat, lng], { icon, interactive: false })
        .addTo(_leafletMap);
    }
  }

  /** Remove the finish flag from the map. */
  function removeMarkMarker() {
    if (_markMarker) {
      _leafletMap.removeLayer(_markMarker);
      _markMarker = null;
    }
  }

  // ── Public: route polyline ───────────────────────────────

  /**
   * Draw or extend the route polyline (ORD_ROUTE — solid red line).
   * Mirrors Android's RouteOverlay for the tracked path.
   * @param {Array<[number,number]>} points  Array of [lat, lng] pairs
   */
  function setRouteLine(points) {
    if (!_initialised) return;

    if (_routePolyline) {
      _leafletMap.removeLayer(_routePolyline);
    }
    if (points.length > 0) {
      _routePolyline = L.polyline(points, {
        color: '#FF0000',
        weight: 5,
        opacity: 0.9,
      }).addTo(_leafletMap);
    }
  }

  /** Clear the route polyline. */
  function clearRouteLine() {
    if (_routePolyline) {
      _leafletMap.removeLayer(_routePolyline);
      _routePolyline = null;
    }
  }

  // ── Public: crow-path polyline to mark ───────────────────

  /**
   * Draw the dashed crow-path line from current position to the mark.
   * Mirrors Android's MARK_ROUTE overlay (PathDashPathEffect).
   * @param {number} fromLat
   * @param {number} fromLng
   * @param {number} toLat
   * @param {number} toLng
   */
  function setMarkLine(fromLat, fromLng, toLat, toLng) {
    if (!_initialised) return;

    if (_markPolyline) {
      _leafletMap.removeLayer(_markPolyline);
    }
    _markPolyline = L.polyline(
      [[fromLat, fromLng], [toLat, toLng]],
      {
        color: '#FF0000',
        weight: 3,
        dashArray: '10, 10',
        opacity: 0.85,
      }
    ).addTo(_leafletMap);
  }

  /** Remove the crow-path line. */
  function clearMarkLine() {
    if (_markPolyline) {
      _leafletMap.removeLayer(_markPolyline);
      _markPolyline = null;
    }
  }

  // ── Public: tap-to-mark (MARK_PLACE) ────────────────────

  /**
   * Register a one-time-per-tap callback for placing the mark by tapping the map.
   * Each tap calls onTap(lat, lng); subsequent taps keep calling it (user can refine).
   * Mirrors Android AddMarkPlace onTouchEvent.
   * @param {Function} onTap  (lat, lng) => void
   */
  function enableTapToMark(onTap) {
    if (!_initialised) return;
    // Remove any existing tap handler first
    if (_tapToMarkHandler) {
      _leafletMap.off('click', _tapToMarkHandler);
    }
    _tapToMarkHandler = (e) => {
      onTap(e.latlng.lat, e.latlng.lng);
    };
    _leafletMap.on('click', _tapToMarkHandler);
  }

  /** Stop responding to map taps for mark placement. */
  function disableTapToMark() {
    if (!_initialised || !_tapToMarkHandler) return;
    _leafletMap.off('click', _tapToMarkHandler);
    _tapToMarkHandler = null;
  }

  // ── Public: GPS info panel ───────────────────────────────

  /**
   * Update the floating GPS info text (lat, lng, accuracy, altitude, distance to mark).
   * Mirrors Android's llalText / textLocation().
   * Pass null or empty string to hide the panel.
   * @param {string} text
   */
  function setInfoText(text) {
    const panel = document.getElementById('gps-info-panel');
    if (!panel) return;
    if (text) {
      panel.textContent = text;
      panel.classList.remove('d-none');
    } else {
      panel.classList.add('d-none');
    }
  }

  // ── Public: expose Leaflet instance ─────────────────────

  /**
   * Return the raw Leaflet map object (for use by other modules).
   * @returns {L.Map|null}
   */
  function getLeafletMap() {
    return _leafletMap;
  }

  // ── Public API ───────────────────────────────────────────
  return {
    init,
    toggleTiles,
    handleBack,
    panTo,
    setBearing,
    resetBearing,
    setPositionMarker,
    removePositionMarker,
    setMarkMarker,
    removeMarkMarker,
    setRouteLine,
    clearRouteLine,
    setMarkLine,
    clearMarkLine,
    enableTapToMark,
    disableTapToMark,
    setInfoText,
    getLeafletMap,
    MAP_ZOOM,
  };

})();
