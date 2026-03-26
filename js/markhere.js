/**
 * markhere.js
 * Handles the "Set Mark" feature in two modes:
 *   MARK_HERE  — collect GPS fix at current location and save it as the mark
 *   MARK_PLACE — geocode a named place OR tap on the map to set the mark
 *
 * Mirrors Android's MapTrack MARK_HERE flow and AddMarkPlace activity.
 * Nominatim is used for geocoding (in place of Android's Geocoder API).
 */

const MarkHere = (() => {

  // ── State ──────────────────────────────────────────────────────
  let _active     = false;   // true while a mark flow is in progress
  let _pendingLat = null;
  let _pendingLng = null;

  // ── Public: MARK_HERE ──────────────────────────────────────────

  /**
   * Start the "Mark here" GPS-fix flow.
   * Collects N fixes (same as WhereAmI), pans the map, then reveals Save.
   * Mirrors MARK_HERE in Android's MapTrack.onResume() / updateLocationWhere().
   */
  function startMarkHere() {
    _active     = true;
    _pendingLat = null;
    _pendingLng = null;

    const numFixes = Settings.get('par_where_fixes4pt');
    AppMap.setInfoText('Acquiring GPS fix 1 of ' + numFixes + '\u2026');

    GPS.collectFixes(
      numFixes,
      (pos, i) => {
        AppMap.setInfoText(
          'GPS fix ' + i + ' of ' + numFixes +
          ' \u2013 acc: \u00b1' + Math.round(pos.coords.accuracy) + '\u00a0m'
        );
      },
      (bestFix) => {
        _pendingLat = bestFix.coords.latitude;
        _pendingLng = bestFix.coords.longitude;
        AppMap.panTo(_pendingLat, _pendingLng);
        AppMap.setPositionMarker(_pendingLat, _pendingLng);
        AppMap.setInfoText(
          _pendingLat.toFixed(5) + ', ' + _pendingLng.toFixed(5)
        );
        _showSave(true);
      },
      (errMsg) => {
        AppMap.setInfoText('GPS error: ' + errMsg);
      }
    );
  }

  // ── Public: MARK_PLACE ─────────────────────────────────────────

  /**
   * Start the "Mark on another place" flow.
   * If a place name is given, forward-geocodes it via Nominatim and pans there.
   * In both cases the user can tap the map to (re-)place the mark.
   * @param {string|null} placeName
   */
  function startMarkPlace(placeName) {
    _active     = true;
    _pendingLat = null;
    _pendingLng = null;

    if (placeName) {
      AppMap.setInfoText('Searching for: ' + placeName + '\u2026');
      _geocodeForward(
        placeName,
        (lat, lng, displayName) => {
          _pendingLat = lat;
          _pendingLng = lng;
          AppMap.panTo(lat, lng, 14);
          AppMap.setMarkMarker(lat, lng);
          AppMap.setInfoText(displayName || placeName);
          _showSave(true);
          _enableTapToPlace();   // user can refine by tapping
        },
        () => {
          AppMap.setInfoText('Place not found. Tap map to set mark.');
          _enableTapToPlace();
        }
      );
    } else {
      AppMap.setInfoText('Tap map to set mark.');
      _enableTapToPlace();
    }
  }

  // ── Public: save / cleanup ─────────────────────────────────────

  /**
   * Save the pending location as the mark.
   * Called by the Save (\uD83D\uDCBE) button in the map navbar.
   * Mirrors Android's saveMark() → Settings.setMarkLatLng() → finish().
   */
  function saveMark() {
    if (_pendingLat === null) return;

    const now    = new Date();
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                    'Jul','Aug','Sep','Oct','Nov','Dec'];
    const dateStr =
      MONTHS[now.getMonth()] +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0');

    Settings.setMark(_pendingLat, _pendingLng, dateStr);
    App.refreshMarkButton();     // update the home-screen button immediately
    App.showView('view-home');   // navigate home; cleanup() will be called from there
  }

  /**
   * Clean up all mark-flow state.
   * Called by App.showView() whenever the user leaves the map view.
   * Safe to call when no mark flow is active (all operations are no-ops).
   */
  function cleanup() {
    if (!_active) return;
    _active     = false;
    _pendingLat = null;
    _pendingLng = null;

    GPS.stop();
    AppMap.disableTapToMark();
    AppMap.removePositionMarker();
    AppMap.removeMarkMarker();
    AppMap.setInfoText('');
    sessionStorage.removeItem('pendingMarkPlace');

    const s = document.getElementById('btnMarkSave');
    const c = document.getElementById('btnMarkCancel');
    if (s) s.classList.add('d-none');
    if (c) c.classList.add('d-none');
  }

  // ── Private helpers ────────────────────────────────────────────

  /** Enable tap-to-place mode: user taps the Leaflet map to set mark position. */
  function _enableTapToPlace() {
    AppMap.enableTapToMark((lat, lng) => {
      _pendingLat = lat;
      _pendingLng = lng;
      AppMap.setMarkMarker(lat, lng);
      _showSave(true);
      // Reverse-geocode to show the address in the info panel
      _geocodeReverse(lat, lng, (displayName) => {
        AppMap.setInfoText(displayName);
      });
    });
  }

  /** Show or hide the Save button. Cancel button is managed by app.js. */
  function _showSave(show) {
    const btn = document.getElementById('btnMarkSave');
    if (btn) btn.classList.toggle('d-none', !show);
  }

  /**
   * Forward-geocode a place name to coordinates via Nominatim.
   * @param {string}   name
   * @param {Function} onSuccess  (lat, lng, displayName) => void
   * @param {Function} onError    () => void
   */
  function _geocodeForward(name, onSuccess, onError) {
    const url =
      'https://nominatim.openstreetmap.org/search?q=' +
      encodeURIComponent(name) + '&format=json&limit=1';

    fetch(url, { headers: { 'Accept-Language': 'en' } })
      .then(r => r.json())
      .then(data => {
        if (data && data.length > 0) {
          onSuccess(
            parseFloat(data[0].lat),
            parseFloat(data[0].lon),
            data[0].display_name
          );
        } else {
          onError();
        }
      })
      .catch(() => onError());
  }

  /**
   * Reverse-geocode coordinates to a display name via Nominatim.
   * @param {number}   lat
   * @param {number}   lng
   * @param {Function} onResult  (displayName) => void
   */
  function _geocodeReverse(lat, lng, onResult) {
    const url =
      'https://nominatim.openstreetmap.org/reverse?lat=' +
      lat + '&lon=' + lng + '&format=json';

    fetch(url, { headers: { 'Accept-Language': 'en' } })
      .then(r => r.json())
      .then(data => {
        if (data && data.display_name) onResult(data.display_name);
      })
      .catch(() => {});
  }

  // ── Public API ─────────────────────────────────────────────────
  return { startMarkHere, startMarkPlace, saveMark, cleanup };

})();
