/**
 * showdirection.js
 * "I am lost – Show Direction!" feature orchestrator.
 * Mirrors Android's MapTrack in SHOW_DIRECTION mode with the
 * directionToggleButton, updateLocation(), and textLocation() logic.
 *
 * Behaviour:
 *  - ▶ Start button begins continuous GPS watch
 *  - Each fix: pans map, rotates map to heading, extends route polyline,
 *    updates info text, updates crow-path to mark (if set)
 *  - ⏹ Stop button halts GPS watch; map stops rotating
 */

const ShowDirection = (() => {

  // Conversion constants (same as whereami.js)
  const FEET_PER_METER  = 1 / 0.3048;
  const METERS_PER_MILE = 1609.344;

  // ── Internal state ────────────────────────────────────────

  let _tracking    = false;
  let _fixCount    = 0;
  let _routePoints = [];   // accumulated [lat, lng] pairs for the route line

  // ── Public API ────────────────────────────────────────────

  /**
   * Called by App.showView() when entering SHOW_DIRECTION mode.
   * Resets the map and shows the Start (▶) button.
   */
  function enter() {
    _stopTracking();
    _reset();
    _updateToggleButton(false);
  }

  /**
   * Stop GPS and reset toggle — called when navigating away.
   */
  function stop() {
    _stopTracking();
  }

  /**
   * Toggle tracking on/off — wired to the ▶/⏹ navbar button.
   */
  function toggleTracking() {
    if (_tracking) {
      _stopTracking();
      _updateToggleButton(false);
    } else {
      _startTracking();
    }
  }

  // ── Private helpers ───────────────────────────────────────

  function _reset() {
    _fixCount    = 0;
    _routePoints = [];
    AppMap.clearRouteLine();
    AppMap.clearMarkLine();
    AppMap.removePositionMarker();
    AppMap.resetBearing();
    AppMap.setInfoText('');

    // Pre-place the mark flag if one is saved
    if (Settings.get('par_isMark')) {
      const markLat = parseFloat(Settings.get('par_markLat'));
      const markLng = parseFloat(Settings.get('par_markLng'));
      AppMap.setMarkMarker(markLat, markLng);
    } else {
      AppMap.removeMarkMarker();
    }
  }

  function _startTracking() {
    _tracking    = true;
    _fixCount    = 0;
    _routePoints = [];
    _lastLat     = null;
    _lastLng     = null;
    AppMap.clearRouteLine();
    AppMap.clearMarkLine();
    AppMap.setInfoText('Waiting for GPS signal\u2026');
    _updateToggleButton(true);

    GPS.watchPosition(
      (pos) => _onFix(pos),
      (msg) => {
        _tracking = false;
        _updateToggleButton(false);
        AppMap.setInfoText('\u26a0 ' + msg);
      }
    );
  }

  function _stopTracking() {
    GPS.stop();
    _tracking = false;
  }

  // Internal state ─ last accepted position (for distance filter)
  let _lastLat = null;
  let _lastLng = null;

  /**
   * Handle each incoming GPS fix during direction tracking.
   * Mirrors Android's locationListener.onLocationChanged() in tracking mode.
   */
  function _onFix(pos) {
    if (!_tracking) return;

    _fixCount++;
    const lat      = pos.coords.latitude;
    const lng      = pos.coords.longitude;
    const accuracy = pos.coords.accuracy;
    const heading  = pos.coords.heading;   // degrees 0-360, null/NaN when stationary
    const altitude = pos.coords.altitude;
    const speed    = pos.coords.speed;     // m/s, null/NaN when stationary

    // ── Distance filter ──────────────────────────────────────────
    // Only plot a new route point if the device has actually moved
    // further than the current fix's accuracy radius.
    // This eliminates jitter: GPS noise stays within the accuracy
    // circle so a stationary phone produces no false route segments.
    if (_lastLat !== null) {
      const moved = GPS.distanceTo(_lastLat, _lastLng, lat, lng);
      if (moved < accuracy) {
        // Position hasn't moved beyond noise — still update the info
        // panel and marker, but don't extend the route line.
        AppMap.setPositionMarker(lat, lng);
        _displayInfo(lat, lng, accuracy, altitude);
        return;
      }
    }

    // Accepted fix — record as the last known position
    _lastLat = lat;
    _lastLng = lng;

    // Extend the route polyline with the new accepted point
    _routePoints.push([lat, lng]);
    AppMap.setRouteLine(_routePoints);

    // Pan map to follow current position
    AppMap.panTo(lat, lng);

    // Rotate map to direction of travel only when actually moving.
    // heading is unreliable (null/NaN/random) when stationary or speed < 0.5 m/s.
    const isMoving = speed !== null && isFinite(speed) && speed >= 0.5;
    if (isMoving && heading !== null && isFinite(heading)) {
      AppMap.setBearing(heading);
    }
    // (don't reset to north when stopping — keep last known bearing)

    // Place or move the position marker
    AppMap.setPositionMarker(lat, lng);

    // Update the dashed crow-fly line to the mark
    if (Settings.get('par_isMark')) {
      const markLat = parseFloat(Settings.get('par_markLat'));
      const markLng = parseFloat(Settings.get('par_markLng'));
      AppMap.setMarkLine(lat, lng, markLat, markLng);
    }

    // Show GPS info text (mirrors textLocation() for direction mode)
    _displayInfo(lat, lng, accuracy, altitude);
  }

  /**
   * Format and display GPS info in the panel.
   * Mirrors Android's textLocation() when where=false (direction mode).
   */
  function _displayInfo(lat, lng, accuracy, altitude) {
    if (!Settings.get('par_direction_show_gps')) {
      AppMap.setInfoText('');
      return;
    }

    const useMiles = Settings.get('par_miles');

    // Current time HH:mm:ss — mirrors Android's formatter.format(calendar.getTime())
    const now  = new Date();
    const time = now.toTimeString().slice(0, 8);

    const lines = [
      `GPS fix #${_fixCount} ${time}`,
      `Latitude:\u00a0\u00a0 ${lat.toFixed(6)}\u00b0`,
      `Longitude: ${lng.toFixed(6)}\u00b0`,
      `Accuracy:\u00a0 ${Math.round(accuracy)}\u00a0m`,
    ];

    if (altitude !== null && isFinite(altitude)) {
      lines.push(`Altitude:\u00a0\u00a0 ${_fmtAltitude(altitude, useMiles)}`);
    }

    if (Settings.get('par_isMark')) {
      const markLat = parseFloat(Settings.get('par_markLat'));
      const markLng = parseFloat(Settings.get('par_markLng'));
      const dist = GPS.distanceTo(lat, lng, markLat, markLng);
      lines.push(`To mark:\u00a0\u00a0 ${_fmtDistance(dist, useMiles)} crow`);
    }

    AppMap.setInfoText(lines.join('\n'));
  }

  // ── Formatting helpers ────────────────────────────────────

  function _fmtAltitude(metres, useMiles) {
    return useMiles
      ? `${Math.round(metres * FEET_PER_METER)}\u00a0ft`
      : `${Math.round(metres)}\u00a0m`;
  }

  function _fmtDistance(metres, useMiles) {
    if (useMiles) {
      const miles = metres / METERS_PER_MILE;
      return miles >= 0.1
        ? `${miles.toFixed(2)}\u00a0mi`
        : `${Math.round(metres * FEET_PER_METER)}\u00a0ft`;
    }
    return metres >= 1000
      ? `${(metres / 1000).toFixed(2)}\u00a0km`
      : `${Math.round(metres)}\u00a0m`;
  }

  /**
   * Update the ▶/⏹ toggle button appearance.
   * @param {boolean} tracking
   */
  function _updateToggleButton(tracking) {
    const btn = document.getElementById('btnDirectionToggle');
    if (!btn) return;
    if (tracking) {
      btn.innerHTML = '<i class="bi bi-stop-circle-fill fs-4"></i>';
      btn.setAttribute('aria-label', 'Stop tracking');
      btn.classList.add('tracking-active');
    } else {
      btn.innerHTML = '<i class="bi bi-play-circle-fill fs-4"></i>';
      btn.setAttribute('aria-label', 'Start tracking');
      btn.classList.remove('tracking-active');
    }
  }

  return { enter, stop, toggleTracking };

})();
