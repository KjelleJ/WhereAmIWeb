/**
 * settings.js
 * Manages all persistent user preferences via localStorage.
 * Mirrors Android's Settings.java / SharedPreferences.
 */

const Settings = (() => {

  // localStorage key name — matches Android prefName
  const PREF_KEY = 'WhereAmI';

  // Default values matching Android Settings.java defaults
  const DEFAULTS = {
    par_where_altitude:      true,   // Get altitude via web service
    par_miles:               false,  // Use feet/miles instead of metres/km
    par_where_show_gps:      true,   // Show GPS info on Where am I screen
    par_direction_show_gps:  true,   // Show GPS info on Direction screen
    par_where_fixes4pt:      3,      // Number of GPS fixes to collect for best fix
    par_isMark:              false,  // Whether a mark is currently set
    par_markLat:             '',     // Saved mark latitude (string)
    par_markLng:             '',     // Saved mark longitude (string)
    par_markDate:            '',     // Saved mark date label
  };

  // In-memory copy of preferences
  let prefs = {};

  /**
   * Load preferences from localStorage into the in-memory object.
   * Called once on app start.
   */
  function load() {
    const stored = localStorage.getItem(PREF_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    // Merge stored values over defaults so new keys always have a value
    prefs = Object.assign({}, DEFAULTS, parsed);
  }

  /**
   * Persist the current in-memory preferences to localStorage.
   * Only persists non-mark settings (mark is saved separately via setMark).
   */
  function save() {
    // Read UI controls into prefs before saving
    _readUI();
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  }

  /**
   * Save mark position and date.
   * @param {string} lat
   * @param {string} lng
   * @param {string} date  Formatted date label, e.g. "Mar25 14:30"
   */
  function setMark(lat, lng, date) {
    prefs.par_isMark    = true;
    prefs.par_markLat   = lat;
    prefs.par_markLng   = lng;
    prefs.par_markDate  = date;
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  }

  /**
   * Clear the saved mark.
   */
  function clearMark() {
    prefs.par_isMark    = false;
    prefs.par_markLat   = '';
    prefs.par_markLng   = '';
    prefs.par_markDate  = '';
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  }

  /**
   * Populate the settings UI controls from the current prefs object.
   * Called when the settings view is shown.
   */
  function populateUI() {
    document.getElementById('chkMiles').checked          = prefs.par_miles;
    document.getElementById('chkAltitude').checked       = prefs.par_where_altitude;
    document.getElementById('chkShowGpsWhere').checked   = prefs.par_where_show_gps;
    document.getElementById('chkShowGpsDirection').checked = prefs.par_direction_show_gps;
    document.getElementById('selFixes').value            = String(prefs.par_where_fixes4pt);
  }

  /**
   * Read settings UI controls back into prefs (before saving).
   * @private
   */
  function _readUI() {
    prefs.par_miles               = document.getElementById('chkMiles').checked;
    prefs.par_where_altitude      = document.getElementById('chkAltitude').checked;
    prefs.par_where_show_gps      = document.getElementById('chkShowGpsWhere').checked;
    prefs.par_direction_show_gps  = document.getElementById('chkShowGpsDirection').checked;
    prefs.par_where_fixes4pt      = parseInt(document.getElementById('selFixes').value, 10);
  }

  // Expose public API
  return {
    load,
    save,
    setMark,
    clearMark,
    populateUI,
    /** Direct access to live preference values */
    get: (key) => prefs[key],
    /** All prefs (read-only snapshot) */
    all: () => Object.assign({}, prefs),
  };

})();
