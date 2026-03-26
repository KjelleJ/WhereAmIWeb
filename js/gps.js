/**
 * gps.js
 * GPS fix collection and best-fix selection.
 * Mirrors Android's LocationListener + RouteOverlay.bestfix() logic.
 *
 * Usage:
 *   GPS.collectFixes(n, onProgress, onDone, onError)
 *   GPS.watchPosition(onUpdate, onError)  — for Show Direction (Step 5)
 *   GPS.stop()
 */

const GPS = (() => {

  let _watchId = null;   // active watchPosition ID

  /**
   * Collect n GPS fixes, then resolve with the best one (lowest accuracy value).
   * Mirrors Android: collecting par_where_fixes4pt fixes then calling
   * RouteOverlay.bestfix() which returns the fix with minimum accuracy.
   *
   * @param {number}   n           Number of fixes to collect (from settings)
   * @param {Function} onProgress  Called with each raw Position as it arrives
   * @param {Function} onDone      Called with the best Position when collection completes
   * @param {Function} onError     Called with a descriptive error string on failure
   */
  function collectFixes(n, onProgress, onDone, onError) {
    if (!('geolocation' in navigator)) {
      onError('GPS not available in this browser.');
      return;
    }

    // Use watchPosition rather than sequential getCurrentPosition calls.
    // iOS Safari blocks nested/sequential getCurrentPosition calls made
    // inside each other's callbacks (a known WebKit restriction), but
    // watchPosition works reliably on all browsers including Safari/iOS.
    // We also try high-accuracy first and fall back to network-based
    // location automatically (needed on desktops with no GPS chip).
    const fixes = [];
    let _collectWatchId = null;
    let _done = false;

    function tryWatch(highAccuracy) {
      _collectWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (_done) return;
          fixes.push(pos);
          if (typeof onProgress === 'function') onProgress(pos, fixes.length, n);

          if (fixes.length >= n) {
            _done = true;
            navigator.geolocation.clearWatch(_collectWatchId);
            _collectWatchId = null;
            onDone(_bestFix(fixes), fixes.length);
          }
        },
        (err) => {
          if (_done) return;
          if (highAccuracy) {
            // Retry without high-accuracy (desktop / network-based fallback)
            navigator.geolocation.clearWatch(_collectWatchId);
            _collectWatchId = null;
            tryWatch(false);
          } else {
            _done = true;
            onError(_geoErrorMsg(err));
          }
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    }

    tryWatch(true);
  }

  /**
   * Start continuous position watching for Show Direction mode.
   * Mirrors Android's locationManager.requestLocationUpdates().
   *
   * @param {Function} onUpdate  Called with each new Position
   * @param {Function} onError   Called with error string
   * @returns {number} watchId — pass to stop() if needed
   */
  function watchPosition(onUpdate, onError) {
    stop(); // clear any existing watch

    _watchId = navigator.geolocation.watchPosition(
      onUpdate,
      (err) => { if (typeof onError === 'function') onError(_geoErrorMsg(err)); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
    return _watchId;
  }

  /**
   * Stop any active GPS watch.
   * Mirrors Android's locationManager.removeUpdates().
   */
  function stop() {
    if (_watchId !== null) {
      navigator.geolocation.clearWatch(_watchId);
      _watchId = null;
    }
  }

  // ── Helpers ──────────────────────────────────────────────

  /**
   * Find the fix with the lowest accuracy value (best precision).
   * Mirrors Android's RouteOverlay.bestfix().
   * @param {GeolocationPosition[]} fixes
   * @returns {GeolocationPosition}
   * @private
   */
  function _bestFix(fixes) {
    return fixes.reduce((best, cur) => {
      const bAcc = best.coords.accuracy;
      const cAcc = cur.coords.accuracy;
      return cAcc < bAcc ? cur : best;
    });
  }

  /**
   * Convert a GeolocationPositionError into a human-readable string.
   * @param {GeolocationPositionError} err
   * @returns {string}
   * @private
   */
  function _geoErrorMsg(err) {
    switch (err.code) {
      case err.PERMISSION_DENIED:
        return 'GPS permission denied. Please allow location access in your browser.';
      case err.POSITION_UNAVAILABLE:
        return 'GPS position unavailable. Make sure GPS is enabled.';
      case err.TIMEOUT:
        return 'GPS timed out. Please try again in an open area.';
      default:
        return 'GPS error: ' + err.message;
    }
  }

  /**
   * Calculate the great-circle distance in metres between two lat/lng pairs.
   * Mirrors Android's location.distanceTo().
   * @param {number} lat1
   * @param {number} lng1
   * @param {number} lat2
   * @param {number} lng2
   * @returns {number} distance in metres
   */
  function distanceTo(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth radius in metres
    const dLat = _toRad(lat2 - lat1);
    const dLng = _toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(_toRad(lat1)) * Math.cos(_toRad(lat2)) *
              Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Calculate the initial bearing from point 1 to point 2 (degrees 0–360).
   * @param {number} lat1
   * @param {number} lng1
   * @param {number} lat2
   * @param {number} lng2
   * @returns {number}
   */
  function bearingTo(lat1, lng1, lat2, lng2) {
    const dLng = _toRad(lng2 - lng1);
    const y = Math.sin(dLng) * Math.cos(_toRad(lat2));
    const x = Math.cos(_toRad(lat1)) * Math.sin(_toRad(lat2)) -
              Math.sin(_toRad(lat1)) * Math.cos(_toRad(lat2)) * Math.cos(dLng);
    return (_toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  function _toRad(d) { return d * Math.PI / 180; }
  function _toDeg(r) { return r * 180 / Math.PI; }

  // ── Public API ───────────────────────────────────────────
  return { collectFixes, watchPosition, stop, distanceTo, bearingTo };

})();
