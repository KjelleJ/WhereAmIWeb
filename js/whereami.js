/**
 * whereami.js
 * "Where am I?" feature orchestrator.
 * Mirrors Android's WhereAmI Activity in WHERE_AM_I mode,
 * plus the logic from RouteOverlay and CommonFun.textLocation().
 */

const WhereAmI = (() => {

  // Conversion constants  (mirrors CommonFun.java)
  const FEET_PER_METER = 1 / 0.3048;
  const METERS_PER_MILE = 1609.344;

  // ── Public entry-point ──────────────────────────────────────────

  /**
   * Start the "Where am I?" flow.
   * Called by App.showView() when mode === 'WHERE_AM_I'.
   */
  function start() {
    _reset();
    _showWaiting();
    _collectAndDisplay();
  }

  /**
   * Stop any in-progress GPS collection.
   * Called when navigating away from the map view.
   */
  function stop() {
    GPS.stop();
    _isRunning = false;
  }

  // ── Internal state ─────────────────────────────────────────────

  let _isRunning = false;

  // ── Helpers ────────────────────────────────────────────────────

  /**
   * Clear previous map overlays.
   */
  function _reset() {
    AppMap.removePositionMarker();
    AppMap.clearRouteLine();
    AppMap.clearMarkLine();
    AppMap.setInfoText('');
  }

  /**
   * Show a "waiting for GPS" status in the info panel while collecting.
   */
  function _showWaiting() {
    AppMap.setInfoText('Waiting for GPS signal\u2026');
  }

  /**
   * Collect N GPS fixes (per settings), pick the best, optionally fetch
   * elevation, then update the AppMap.
   */
  function _collectAndDisplay() {
    _isRunning = true;
    const n = parseInt(Settings.get('par_where_fixes4pt'), 10) || 3;

    GPS.collectFixes(
      n,
      // onProgress — update the info panel with live fix count
      (pos, received, total) => {
        AppMap.setInfoText(
          `Collecting GPS fixes\u2026 (${received}/${total})\n` +
          `Current accuracy: ${_fmtAccuracy(pos.coords.accuracy)}`
        );
      },
      // onDone — best fix selected
      (best, total) => {
        if (!_isRunning) return;
        _isRunning = false;

        const lat = best.coords.latitude;
        const lng = best.coords.longitude;
        const accuracy = best.coords.accuracy;
        const gpsAltitude = best.coords.altitude;

        // Pan map and place marker immediately
        AppMap.panTo(lat, lng);
        AppMap.setPositionMarker(lat, lng);

        // Draw mark overlay if a mark is saved
        _updateMarkOverlay(lat, lng);

        // Optionally fetch terrain elevation, then display info text
        if (Settings.get('par_where_altitude')) {
          Elevation.get(lat, lng, (terrainAlt) => {
            const altitude = isFinite(terrainAlt) ? terrainAlt : (gpsAltitude || null);
            _displayInfo(lat, lng, accuracy, altitude, total);
          });
        } else {
          _displayInfo(lat, lng, accuracy, gpsAltitude || null, total);
        }
      },
      // onError
      (msg) => {
        _isRunning = false;
        AppMap.setInfoText('\u26a0 ' + msg);
      }
    );
  }

  /**
   * Format and show the GPS result in the info panel.
   * Mirrors Android's CommonFun.textLocation().
   *
   * @param {number} lat
   * @param {number} lng
   * @param {number} accuracy   metres
   * @param {number|null} altitude  metres, or null if unavailable
   * @param {number} fixCount
   */
  function _displayInfo(lat, lng, accuracy, altitude, fixCount) {
    const useMiles = Settings.get('par_miles');
    const show = Settings.get('par_where_show_gps');

    if (!show) {
      // Info panel suppressed by settings — still place the marker
      AppMap.setInfoText('');
      return;
    }

    const lines = [
      `Best GPS fix (${fixCount} fixes)`,
      `Latitude:\u00a0\u00a0 ${lat.toFixed(6)}\u00b0`,
      `Longitude: ${lng.toFixed(6)}\u00b0`,
      `Accuracy:\u00a0 ${_fmtAccuracy(accuracy)}`,
    ];

    if (altitude !== null && isFinite(altitude)) {
      lines.push(`Altitude:\u00a0\u00a0 ${_fmtAltitude(altitude, useMiles)}`);
    }

    // Distance to mark
    if (Settings.get('par_isMark')) {
      const markLat = parseFloat(Settings.get('par_markLat'));
      const markLng = parseFloat(Settings.get('par_markLng'));
      const dist = GPS.distanceTo(lat, lng, markLat, markLng);
      lines.push(`To mark:\u00a0\u00a0 ${_fmtDistance(dist, useMiles)} crow`);
    }

    AppMap.setInfoText(lines.join('\n'));
  }

  /**
   * If a mark is saved, draw the crow-fly line and place the mark flag.
   * @param {number} posLat
   * @param {number} posLng
   */
  function _updateMarkOverlay(posLat, posLng) {
    if (Settings.get('par_isMark')) {
      const markLat = parseFloat(Settings.get('par_markLat'));
      const markLng = parseFloat(Settings.get('par_markLng'));
      AppMap.setMarkMarker(markLat, markLng);
      AppMap.setMarkLine(posLat, posLng, markLat, markLng);
    } else {
      AppMap.removeMarkMarker();
      AppMap.clearMarkLine();
    }
  }

  // ── Formatting helpers ────────────────────────────────────────────

  /**
   * Format accuracy in metres (always metres — GPS accuracy is not
   * converted to imperial in the original Android app).
   */
  function _fmtAccuracy(metres) {
    return `${Math.round(metres)}\u00a0m`;
  }

  /**
   * Format altitude based on user preference.
   * Android used the same unit as distance (metres vs feet).
   */
  function _fmtAltitude(metres, useMiles) {
    if (useMiles) {
      const feet = Math.round(metres * FEET_PER_METER);
      return `${feet}\u00a0ft`;
    }
    return `${Math.round(metres)}\u00a0m`;
  }

  /**
   * Format a distance in metres to either "X.X km / X m" or "X.X mi / X ft".
   * Mirrors Android's CommonFun.metresAsMilesOrKm().
   */
  function _fmtDistance(metres, useMiles) {
    if (useMiles) {
      const miles = metres / METERS_PER_MILE;
      if (miles >= 0.1) return `${miles.toFixed(2)}\u00a0mi`;
      const feet = metres * FEET_PER_METER;
      return `${Math.round(feet)}\u00a0ft`;
    }
    if (metres >= 1000) return `${(metres / 1000).toFixed(2)}\u00a0km`;
    return `${Math.round(metres)}\u00a0m`;
  }

  // ── Public API ────────────────────────────────────────────────────
  return { start, stop };

})();
