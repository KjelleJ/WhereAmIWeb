/**
 * app.js
 * Application shell — navigation, view switching, and home-screen logic.
 * Mirrors the Android WhereAmI Activity lifecycle and button handlers.
 */

const App = (() => {

  // All view element IDs in the SPA
  const ALL_VIEWS = ['view-home', 'view-settings', 'view-map', 'view-help'];

  // Tracks whether the browser supports geolocation
  let gpsAvailable = false;

  // The mode passed when opening the map view
  // Values match Android constants: 'WHERE_AM_I' | 'SHOW_DIRECTION' | 'MARK_HERE'
  let mapMode = null;

  // Bootstrap modal instance for reusable confirm dialogs
  let _confirmModal = null;
  let _confirmOKHandler = null;

  // ── Initialisation ──────────────────────────────────────────────

  /**
   * Boot the application.
   * Called once the DOM is ready (see bottom of this file).
   */
  function init() {
    Settings.load();
    gpsAvailable = ('geolocation' in navigator);

    if (!gpsAvailable) {
      document.getElementById('gps-alert').classList.remove('d-none');
      _disableGpsButtons();
    }

    _updateMarkButton();

    // Initialise Bootstrap modal
    _confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));

    // Wire up the confirm modal OK button dynamically
    document.getElementById('confirmModalOK').addEventListener('click', () => {
      _confirmModal.hide();
      if (typeof _confirmOKHandler === 'function') {
        _confirmOKHandler();
        _confirmOKHandler = null;
      }
    });
  }

  // ── View navigation ─────────────────────────────────────────────

  /**
   * Show a named view and hide all others.
   * @param {string} viewId  - e.g. 'view-settings'
   * @param {string} [mode]  - optional map mode for 'view-map'
   */
  function showView(viewId, mode) {
    ALL_VIEWS.forEach(id => {
      document.getElementById(id).classList.toggle('d-none', id !== viewId);
    });
    // Reset body scroll so the non-fixed views (home, settings, help) always
    // start at the top after returning from a modal or another view.
    window.scrollTo(0, 0);

    if (viewId === 'view-settings') {
      Settings.populateUI();
    }

    if (viewId === 'view-map' && mode) {
      mapMode = mode;
      _setMapTitle(mode);
      // Initialise (or refresh) the Leaflet map now that the container is visible
      AppMap.init();
      // Show / hide mode-specific navbar buttons
      const btnRefresh    = document.getElementById('btnRefreshWhere');
      const btnDirection  = document.getElementById('btnDirectionToggle');
      const btnMarkSave   = document.getElementById('btnMarkSave');
      const btnMarkCancel = document.getElementById('btnMarkCancel');
      const isMarkMode    = mode === 'MARK_HERE' || mode === 'MARK_PLACE';
      if (btnRefresh)    btnRefresh.classList.toggle('d-none',   mode !== 'WHERE_AM_I');
      if (btnDirection)  btnDirection.classList.toggle('d-none', mode !== 'SHOW_DIRECTION');
      if (btnMarkSave)   btnMarkSave.classList.add('d-none');           // shown by markhere.js when ready
      if (btnMarkCancel) btnMarkCancel.classList.toggle('d-none', !isMarkMode);
      // Start the appropriate GPS flow
      if (mode === 'WHERE_AM_I')     WhereAmI.start();
      if (mode === 'SHOW_DIRECTION') ShowDirection.enter();
      if (mode === 'MARK_HERE')      MarkHere.startMarkHere();
      if (mode === 'MARK_PLACE')     MarkHere.startMarkPlace(sessionStorage.getItem('pendingMarkPlace'));
    }

    if (viewId === 'view-home') {
      // Stop any active GPS when returning home
      ShowDirection.stop();
      GPS.stop();
      MarkHere.cleanup();
      _updateMarkButton();
    }
  }

  /**
   * Set the map screen title to match Android's activity titles.
   * @param {string} mode
   * @private
   */
  function _setMapTitle(mode) {
    const titles = {
      WHERE_AM_I:     'Where am I? \u2013 Where am I?',
      SHOW_DIRECTION: 'Where am I? \u2013 Show Direction!',
      MARK_HERE:      'Where am I? \u2013 Set Mark',
      MARK_PLACE:     'Where am I? \u2013 Set Mark on Place',
    };
    document.getElementById('map-title').textContent = titles[mode] || 'Map';
  }

  // ── Mark button ─────────────────────────────────────────────────

  /**
   * Update the Mark button label to reflect whether a mark is set.
   * Mirrors Android's onStart() mark-button logic.
   * @private
   */
  function _updateMarkButton() {
    const btn = document.getElementById('btnMark');
    if (Settings.get('par_isMark')) {
      btn.textContent = 'Mark ' + Settings.get('par_markDate');
    } else {
      btn.textContent = 'Set Mark';
    }
  }

  /**
   * Handle the Mark button tap.
   * If mark is already set → offer to remove it.
   * Otherwise → show mark-option dialog (Mark here / Mark on another place).
   * Mirrors Android's btnMarkListener.
   */
  function handleMarkButton() {
    if (Settings.get('par_isMark')) {
      _showConfirm('Remove Mark', 'Remove Mark?', () => {
        Settings.clearMark();
        _updateMarkButton();
      });
    } else {
      _showMarkOptions();
    }
  }

  /**
   * Display the "Set mark on map" options dialog.
   * Mirrors Android's markOptBuilder (Mark here / Mark on another place / Cancel).
   * @private
   */
  function _showMarkOptions() {
    _showConfirm(
      'Set mark on map',
      `<div class="list-group list-group-flush">
         <button class="list-group-item list-group-item-action whereami-label"
                 id="_markOptHere">Mark here</button>
         <button class="list-group-item list-group-item-action whereami-label"
                 id="_markOptPlace">Mark on another place</button>
       </div>`,
      null,   // no single OK handler — buttons handle themselves
      false   // hide default OK button
    );

    // Wire option buttons inside modal body
    setTimeout(() => {
      document.getElementById('_markOptHere').addEventListener('click', () => {
        _confirmModal.hide();
        showView('view-map', 'MARK_HERE');
      });
      document.getElementById('_markOptPlace').addEventListener('click', () => {
        // Wait for the hide animation to finish before showing the next dialog.
        // Calling .show() while the modal is still animating out causes Bootstrap
        // to silently drop the .show() call, leaving the user on the home screen.
        document.getElementById('confirmModal').addEventListener(
          'hidden.bs.modal',
          _showGetPlaceDialog,
          { once: true }
        );
        _confirmModal.hide();
      });
    }, 50);
  }

  /**
   * Show the "Set Mark on Place" text-input dialog.
   * Mirrors Android's getPlace() dialog with EditText.
   * @private
   */
  function _showGetPlaceDialog() {
    document.getElementById('confirmModalTitle').textContent = 'Set Mark on Place';
    document.getElementById('confirmModalBody').innerHTML =
      `<input type="text" class="form-control" id="_placeInput"
              placeholder="Enter place name or address"
              aria-label="Place name" />`;

    const okBtn = document.getElementById('confirmModalOK');
    okBtn.style.display = '';
    _confirmOKHandler = () => {
      const place = document.getElementById('_placeInput').value.trim();
      if (place) {
        sessionStorage.setItem('pendingMarkPlace', place);
        showView('view-map', 'MARK_PLACE');
      }
    };
    _confirmModal.show();
  }

  // ── Settings navigation ─────────────────────────────────────────

  /**
   * Handle the Back button inside the Settings screen.
   * Navigates back to the home view without saving.
   * The explicit Save button at the top of the Settings screen
   * is used to persist changes.
   */
  function settingsBack() {
    showView('view-home');
  }

  // ── Utility ─────────────────────────────────────────────────────

  /**
   * Show a reusable Bootstrap confirm dialog.
   * @param {string}   title
   * @param {string}   body        HTML or plain text
   * @param {Function} onOK        Callback for the OK button
   * @param {boolean}  [showOK=true]
   */
  function _showConfirm(title, body, onOK, showOK = true) {
    document.getElementById('confirmModalTitle').textContent = title;
    document.getElementById('confirmModalBody').innerHTML = body;
    const okBtn = document.getElementById('confirmModalOK');
    okBtn.style.display = showOK ? '' : 'none';
    _confirmOKHandler = onOK;
    // Reset cancel to default dismiss behaviour
    document.getElementById('confirmModalCancel').onclick = null;
    _confirmModal.show();
  }

  /**
   * Disable all buttons that require GPS when geolocation is not available.
   * Mirrors Android's GPS-disabled logic in onCreate / onStart.
   * @private
   */
  function _disableGpsButtons() {
    ['btnWhere', 'btnDirection', 'btnMark'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = true;
    });
  }

  // ── Public API ───────────────────────────────────────────────────
  return {
    init,
    showView,
    handleMarkButton,
    settingsBack,
    /** Expose current map mode for AppMap.js (added in Step 3) */
    getMapMode: () => mapMode,
    /** Called by markhere.js after saving/removing a mark to refresh the button label. */
    refreshMarkButton: _updateMarkButton,
  };

})();

// Boot when DOM is ready
document.addEventListener('DOMContentLoaded', App.init);
