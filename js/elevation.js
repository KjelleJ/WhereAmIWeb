/**
 * elevation.js
 * Fetches altitude from the Open-Meteo Elevation API.
 * Free, no API key, CORS-enabled.
 * Replaces Android's ElevationFromGoogleMaps (Google Elevation XML API).
 *
 * API docs: https://open-meteo.com/en/docs/elevation-api
 */

const Elevation = (() => {

  const API_URL = 'https://api.open-meteo.com/v1/elevation';

  /**
   * Fetch the terrain elevation at a given lat/lng.
   * Returns NaN on error (so callers can fall back to GPS altitude).
   *
   * @param {number}   lat
   * @param {number}   lng
   * @param {Function} onDone   Called with elevation in metres (number, may be NaN)
   */
  function get(lat, lng, onDone) {
    const url = `${API_URL}?latitude=${lat}&longitude=${lng}`;

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        // Response: { "elevation": [123.4] }
        const val = Array.isArray(data.elevation) ? data.elevation[0] : NaN;
        onDone(isFinite(val) ? val : NaN);
      })
      .catch(() => {
        // On any error return NaN — caller will fall back to GPS altitude
        onDone(NaN);
      });
  }

  return { get };

})();
