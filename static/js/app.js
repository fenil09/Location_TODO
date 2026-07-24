/**
 * GeoTask - Location-Based TODO Frontend Logic
 * Leaflet.js Map + Geolocation Tracking + Proximity Geofencing Alerts
 */

class GeoTaskApp {
  constructor() {
    // State
    this.tasks = [];
    this.userLocation = null; // { lat, lng }
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.isBackendOnline = false;
    this.notifiedTaskIds = new Set(); // Avoid repeated alert spam for same task

    // Map & Layers
    this.map = null;
    this.userMarker = null;
    this.userAccuracyCircle = null;
    this.searchMarker = null;
    this.taskMarkersGroup = null;
    this.taskCirclesGroup = null;
    this.selectedMapLocation = null;
    this.searchDebounceTimer = null;

    // DOM Elements
    this.initDOMElements();

    // Initialize App
    this.initMap();
    this.initEventListeners();
    this.initGeolocationTracking();
    this.checkBackendConnection();

    // Load initial tasks (Localstorage fallback if API offline)
    this.loadTasks();
  }

  /* ==========================================================================
     1. Initialization & Map Setup
     ========================================================================== */
  initDOMElements() {
    this.taskListEl = document.getElementById('task-list');
    this.emptyStateEl = document.getElementById('empty-state');
    this.taskModal = document.getElementById('task-modal');
    this.taskForm = document.getElementById('task-form');
    this.modalTitle = document.getElementById('modal-title');

    // Inputs
    this.taskIdInput = document.getElementById('task-id');
    this.taskTitleInput = document.getElementById('task-title');
    this.taskDescInput = document.getElementById('task-desc');
    this.taskAddressInput = document.getElementById('task-address');
    this.taskLatInput = document.getElementById('task-lat');
    this.taskLngInput = document.getElementById('task-lng');
    this.taskRadiusInput = document.getElementById('task-radius');
    this.radiusDisplay = document.getElementById('radius-value-display');
    this.searchInput = document.getElementById('task-search-input');
    this.mapSearchInput = document.getElementById('map-address-search');
    this.addressSuggestions = document.getElementById('address-suggestions');

    // Buttons & Status
    this.openAddBtn = document.getElementById('open-add-modal-btn');
    this.closeModalBtn = document.getElementById('close-modal-btn');
    this.cancelBtn = document.getElementById('cancel-task-btn');
    this.recenterBtn = document.getElementById('recenter-user-btn');
    this.locateMeFloating = document.getElementById('locate-me-floating');
    this.sidebarToggleBtn = document.getElementById('toggle-sidebar-btn');
    this.mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    this.sidebar = document.getElementById('sidebar');
    this.gpsIndicator = document.getElementById('gps-indicator');
    this.gpsStatusTitle = document.getElementById('gps-status-title');
    this.gpsStatusCoords = document.getElementById('gps-status-coords');
    this.apiDot = document.getElementById('api-dot');
    this.apiStatusText = document.getElementById('api-status-text');
  }

  initMap() {
    // Default to San Francisco coordinates (overridden when GPS acquires user location)
    const defaultLat = 37.7749;
    const defaultLng = -122.4194;

    this.map = L.map('map', {
      zoomControl: false
    }).setView([defaultLat, defaultLng], 14);

    // High detail Voyager tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this.map);

    // Zoom controls bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // Layer groups for clean updates
    this.taskMarkersGroup = L.layerGroup().addTo(this.map);
    this.taskCirclesGroup = L.layerGroup().addTo(this.map);

    // Map Click Listener to pick location for new task
    this.map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      this.selectedMapLocation = { lat, lng };
      this.openTaskModal({ lat, lng });
      this.reverseGeocode(lat, lng);
      this.hideSuggestions();
    });
  }

  /* ==========================================================================
     2. Event Listeners & Modals
     ========================================================================== */
  initEventListeners() {
    // Open / Close Modal
    this.openAddBtn.addEventListener('click', () => {
      const coords = this.userLocation || { lat: 37.7749, lng: -122.4194 };
      this.openTaskModal(coords);
    });

    this.closeModalBtn.addEventListener('click', () => this.closeTaskModal());
    this.cancelBtn.addEventListener('click', () => this.closeTaskModal());

    // Task Form Submit
    this.taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit();
    });

    // Radius Slider Input
    this.taskRadiusInput.addEventListener('input', (e) => {
      this.radiusDisplay.textContent = `${e.target.value} meters`;
    });

    // Sidebar Search & Filters
    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.renderTasks();
    });

    document.querySelectorAll('.filter-pills .pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-pills .pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.currentFilter = pill.dataset.filter;
        this.renderTasks();
      });
    });

    // Recenter & Locate Me
    this.recenterBtn.addEventListener('click', () => this.recenterMapToUser());
    this.locateMeFloating.addEventListener('click', () => this.recenterMapToUser());

    // Sidebar Collapsing
    const toggleSidebar = () => this.sidebar.classList.toggle('collapsed');
    this.sidebarToggleBtn.addEventListener('click', toggleSidebar);
    this.mobileMenuToggle.addEventListener('click', toggleSidebar);

    // Enhanced Precision Map Search & Auto-complete
    document.getElementById('search-address-btn').addEventListener('click', () => {
      this.searchMapAddress(this.mapSearchInput.value);
    });

    this.mapSearchInput.addEventListener('input', (e) => {
      clearTimeout(this.searchDebounceTimer);
      const query = e.target.value.trim();
      if (query.length < 3) {
        this.hideSuggestions();
        return;
      }
      this.searchDebounceTimer = setTimeout(() => {
        this.fetchSearchSuggestions(query);
      }, 300);
    });

    this.mapSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.searchMapAddress(this.mapSearchInput.value);
      }
    });

    // Hide suggestions on document click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.map-search-overlay')) {
        this.hideSuggestions();
      }
    });

    // Lookup Button in Modal
    document.getElementById('geocode-btn').addEventListener('click', () => {
      const address = this.taskAddressInput.value;
      if (address) this.forwardGeocodeModal(address);
    });
  }

  openTaskModal(coords = null, taskToEdit = null) {
    this.taskForm.reset();

    if (taskToEdit) {
      this.modalTitle.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Location Task`;
      this.taskIdInput.value = taskToEdit.id;
      this.taskTitleInput.value = taskToEdit.title;
      this.taskDescInput.value = taskToEdit.description || '';
      this.taskAddressInput.value = taskToEdit.address_name || '';
      this.taskLatInput.value = taskToEdit.latitude;
      this.taskLngInput.value = taskToEdit.longitude;
      this.taskRadiusInput.value = taskToEdit.radius_meters || 100;
      this.radiusDisplay.textContent = `${taskToEdit.radius_meters || 100} meters`;
    } else {
      this.modalTitle.innerHTML = `<i class="fa-solid fa-thumbtack"></i> New Location Task`;
      this.taskIdInput.value = '';
      this.taskRadiusInput.value = 100;
      this.radiusDisplay.textContent = `100 meters`;

      if (coords) {
        this.taskLatInput.value = coords.lat.toFixed(6);
        this.taskLngInput.value = coords.lng.toFixed(6);
      }
    }

    this.taskModal.classList.remove('hidden');
  }

  closeTaskModal() {
    this.taskModal.classList.add('hidden');
    this.taskForm.reset();
  }

  /* ==========================================================================
     3. Geolocation & Proximity Alert System
     ========================================================================== */
  initGeolocationTracking() {
    // Request desktop notification permission for system-level geofence alerts
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }

    if (!('geolocation' in navigator)) {
      this.updateGPSStatus('error', 'GPS Unavailable', 'Browser does not support Geolocation');
      return;
    }

    this.updateGPSStatus('warning', 'Acquiring GPS...', 'Requesting position permission');

    // Real-time position watching
    navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        this.userLocation = { lat: latitude, lng: longitude };

        this.updateGPSStatus(
          'active',
          'GPS Connected',
          `${latitude.toFixed(4)}, ${longitude.toFixed(4)} (±${Math.round(accuracy)}m)`
        );

        this.updateUserMarkerOnMap(latitude, longitude, accuracy);
        this.checkProximityToTasks();
        this.renderTasks(); // Update distance badges
      },
      (error) => {
        console.warn('Geolocation error:', error.message);
        this.updateGPSStatus('warning', 'Simulated Location', 'Defaulting to map center');

        // Fallback default coordinates if user denies or GPS unavailable
        if (!this.userLocation) {
          this.userLocation = { lat: 37.7749, lng: -122.4194 };
          this.updateUserMarkerOnMap(37.7749, -122.4194, 50);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );
  }

  updateGPSStatus(state, title, subtitle) {
    this.gpsIndicator.className = `status-indicator ${state}`;
    this.gpsStatusTitle.textContent = title;
    this.gpsStatusCoords.textContent = subtitle;
  }

  updateUserMarkerOnMap(lat, lng, accuracy) {
    const latlng = [lat, lng];

    if (!this.userMarker) {
      const userIcon = L.divIcon({
        className: 'user-location-pin',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      this.userMarker = L.marker(latlng, { icon: userIcon, zIndexOffset: 1000 })
        .bindPopup('<b>Your Current Location</b>')
        .addTo(this.map);

      this.userAccuracyCircle = L.circle(latlng, {
        radius: accuracy || 50,
        color: '#06b6d4',
        fillColor: '#06b6d4',
        fillOpacity: 0.1,
        weight: 1
      }).addTo(this.map);

      this.map.setView(latlng, 15);
    } else {
      this.userMarker.setLatLng(latlng);
      this.userAccuracyCircle.setLatLng(latlng);
      this.userAccuracyCircle.setRadius(accuracy || 50);
    }
  }

  recenterMapToUser() {
    if (this.userLocation) {
      this.map.flyTo([this.userLocation.lat, this.userLocation.lng], 16, { duration: 1.2 });
    }
  }

  // Haversine Distance Formula (meters)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  checkProximityToTasks() {
    if (!this.userLocation || !this.tasks.length) return;

    this.tasks.forEach(task => {
      if (task.completed) return;

      const dist = this.calculateDistance(
        this.userLocation.lat,
        this.userLocation.lng,
        task.latitude,
        task.longitude
      );

      const radius = task.radius_meters || 100;
      const isInside = dist <= radius;

      if (isInside && !this.notifiedTaskIds.has(task.id)) {
        this.notifiedTaskIds.add(task.id);
        this.triggerProximityAlert(task, Math.round(dist));
      } else if (!isInside) {
        this.notifiedTaskIds.delete(task.id); // Reset so alert can trigger again if re-entering
      }
    });
  }

  triggerProximityAlert(task, distanceMeters) {
    // 1. Play synthesized audio chime using Web Audio API
    this.playChimeSound();

    // 2. Display Toast Notification
    const toastContainer = document.getElementById('proximity-alert-container');
    const toast = document.createElement('div');
    toast.className = 'proximity-toast';
    toast.innerHTML = `
      <div class="toast-icon"><i class="fa-solid fa-bell-ring"></i></div>
      <div class="toast-content">
        <h4>Task Nearby (${distanceMeters}m away)</h4>
        <p>${this.escapeHtml(task.title)}</p>
      </div>
    `;

    toastContainer.appendChild(toast);

    // 3. Display OS Desktop Notification
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(`Task Nearby (${distanceMeters}m away)`, {
          body: task.title + (task.address_name ? ` - ${task.address_name}` : ''),
          icon: 'https://cdn-icons-png.flaticon.com/512/684/684908.png'
        });
      } catch (e) {
        console.log('Desktop notification error:', e);
      }
    }

    setTimeout(() => {
      toast.style.animation = 'toast-in 0.3s reverse ease-in';
      setTimeout(() => toast.remove(), 300);
    }, 6000);
  }

  playChimeSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const ctx = new AudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 note
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5 note

      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {
      console.log('Audio chime error:', e);
    }
  }

  /* ==========================================================================
     4. Task Data & Backend Integration (FastAPI / LocalStorage)
     ========================================================================== */
  async checkBackendConnection() {
    try {
      const res = await fetch('/api/todos', { method: 'GET' });
      if (res.ok) {
        this.isBackendOnline = true;
        this.apiDot.className = 'api-dot online';
        this.apiStatusText.textContent = 'Connected to FastAPI & Firestore';
        return;
      }
    } catch (e) {
      // API Offline
    }
    this.isBackendOnline = false;
    this.apiDot.className = 'api-dot offline';
    this.apiStatusText.textContent = 'Standby Mode (FastAPI offline - using LocalStorage)';
  }

  async loadTasks() {
    await this.checkBackendConnection();

    if (this.isBackendOnline) {
      try {
        const res = await fetch('/api/todos');
        this.tasks = await res.json();
      } catch (e) {
        this.tasks = this.getLocalTasks();
      }
    } else {
      this.tasks = this.getLocalTasks();
    }

    this.renderTasks();
    this.renderMapMarkers();
  }

  getLocalTasks() {
    const data = localStorage.getItem('geotask_items');
    return data ? JSON.parse(data) : [
      {
        id: 'sample-1',
        title: 'Handel\'s Homemade Ice Cream - Long Beach',
        description: 'Try the mint chocolate chip or graham central station!',
        latitude: 33.7558,
        longitude: -118.1189,
        address_name: '4201 E Ocean Blvd, Long Beach, CA',
        radius_meters: 150,
        completed: false,
        created_at: new Date().toISOString()
      }
    ];
  }

  saveLocalTasks() {
    localStorage.setItem('geotask_items', JSON.stringify(this.tasks));
  }

  async handleFormSubmit() {
    const id = this.taskIdInput.value;
    const taskData = {
      id: id || 'task_' + Date.now(),
      title: this.taskTitleInput.value.trim(),
      description: this.taskDescInput.value.trim(),
      address_name: this.taskAddressInput.value.trim(),
      latitude: parseFloat(this.taskLatInput.value),
      longitude: parseFloat(this.taskLngInput.value),
      radius_meters: parseInt(this.taskRadiusInput.value, 10) || 100,
      completed: false,
      created_at: new Date().toISOString()
    };

    if (this.isBackendOnline) {
      try {
        if (id) {
          await fetch(`/api/todos/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
          });
        } else {
          await fetch('/api/todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
          });
        }
      } catch (e) {
        console.error('API Save Error:', e);
      }
    }

    // Update in-memory & localstorage
    if (id) {
      const idx = this.tasks.findIndex(t => t.id === id);
      if (idx !== -1) this.tasks[idx] = { ...this.tasks[idx], ...taskData };
    } else {
      this.tasks.unshift(taskData);
    }

    this.saveLocalTasks();
    this.closeTaskModal();
    this.renderTasks();
    this.renderMapMarkers();
  }

  async toggleTaskComplete(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;

    if (this.isBackendOnline) {
      try {
        await fetch(`/api/todos/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed: task.completed })
        });
      } catch (e) {
        console.error('API Toggle Error:', e);
      }
    }

    this.saveLocalTasks();
    this.renderTasks();
    this.renderMapMarkers();
  }

  async deleteTask(id) {
    if (this.isBackendOnline) {
      try {
        await fetch(`/api/todos/${id}`, { method: 'DELETE' });
      } catch (e) {
        console.error('API Delete Error:', e);
      }
    }

    this.tasks = this.tasks.filter(t => t.id !== id);
    this.saveLocalTasks();
    this.renderTasks();
    this.renderMapMarkers();
  }

  /* ==========================================================================
     5. Rendering Engine (List & Map Pins)
     ========================================================================== */
  renderTasks() {
    this.taskListEl.innerHTML = '';

    // Calculate distance for all tasks
    const tasksWithDist = this.tasks.map(task => {
      let dist = null;
      let isInside = false;

      if (this.userLocation) {
        dist = this.calculateDistance(
          this.userLocation.lat,
          this.userLocation.lng,
          task.latitude,
          task.longitude
        );
        isInside = dist <= (task.radius_meters || 100);
      }
      return { ...task, distance: dist, isInside };
    });

    // Apply Filter
    let filtered = tasksWithDist.filter(task => {
      if (this.searchQuery) {
        const matchesTitle = task.title.toLowerCase().includes(this.searchQuery);
        const matchesDesc = (task.description || '').toLowerCase().includes(this.searchQuery);
        const matchesAddr = (task.address_name || '').toLowerCase().includes(this.searchQuery);
        if (!matchesTitle && !matchesDesc && !matchesAddr) return false;
      }

      if (this.currentFilter === 'active') return !task.completed;
      if (this.currentFilter === 'completed') return task.completed;
      if (this.currentFilter === 'nearby') return task.isInside || (task.distance !== null && task.distance <= 1000);
      return true;
    });

    if (filtered.length === 0) {
      this.emptyStateEl.classList.remove('hidden');
      return;
    } else {
      this.emptyStateEl.classList.add('hidden');
    }

    filtered.forEach(task => {
      const card = document.createElement('div');
      card.className = `task-card ${task.completed ? 'completed' : ''} ${task.isInside && !task.completed ? 'inside-geofence' : ''}`;

      let distanceText = 'Distance unknown';
      let badgeClass = 'badge-distance out-range';

      if (task.distance !== null) {
        const distKm = task.distance >= 1000 ? `${(task.distance / 1000).toFixed(1)}km` : `${Math.round(task.distance)}m`;
        if (task.isInside && !task.completed) {
          distanceText = `<i class="fa-solid fa-bullseye"></i> ${distKm} away (INSIDE GEOFENCE)`;
          badgeClass = 'badge-distance in-range';
        } else {
          distanceText = `<i class="fa-solid fa-location-arrow"></i> ${distKm} away`;
        }
      }

      card.innerHTML = `
        <div class="task-card-header">
          <div class="checkbox-custom" data-action="toggle" data-id="${task.id}">
            ${task.completed ? '<i class="fa-solid fa-check"></i>' : ''}
          </div>
          <div class="task-title">${this.escapeHtml(task.title)}</div>
        </div>
        ${task.description ? `<div class="task-desc">${this.escapeHtml(task.description)}</div>` : ''}
        <div class="task-location-meta">
          <span class="${badgeClass}">${distanceText}</span>
          ${task.address_name ? `<span><i class="fa-solid fa-map-pin"></i> ${this.escapeHtml(task.address_name)}</span>` : ''}
        </div>
        <div class="task-card-actions">
          <button class="btn-card-action" data-action="focus" data-id="${task.id}" title="Focus on map">
            <i class="fa-solid fa-map-location"></i> Map
          </button>
          <button class="btn-card-action" data-action="edit" data-id="${task.id}" title="Edit task">
            <i class="fa-solid fa-pen"></i> Edit
          </button>
          <button class="btn-card-action delete" data-action="delete" data-id="${task.id}" title="Delete task">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </div>
      `;

      // Event delegation inside card
      card.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const id = btn.dataset.id;

        if (action === 'toggle') this.toggleTaskComplete(id);
        else if (action === 'delete') this.deleteTask(id);
        else if (action === 'edit') this.openTaskModal(null, task);
        else if (action === 'focus') this.focusTaskOnMap(task);
      });

      this.taskListEl.appendChild(card);
    });
  }

  renderMapMarkers() {
    this.taskMarkersGroup.clearLayers();
    this.taskCirclesGroup.clearLayers();

    this.tasks.forEach(task => {
      const isInside = this.userLocation &&
        (this.calculateDistance(this.userLocation.lat, this.userLocation.lng, task.latitude, task.longitude) <= (task.radius_meters || 100));

      let pinClass = 'custom-task-pin';
      if (task.completed) pinClass += ' completed-pin';
      else if (isInside) pinClass += ' inside-pin';

      const icon = L.divIcon({
        className: pinClass,
        html: `<i class="fa-solid ${task.completed ? 'fa-check' : 'fa-thumbtack'}"></i>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      const marker = L.marker([task.latitude, task.longitude], { icon });

      // Circle Radius Geofence Visualizer
      const circleColor = task.completed ? '#64748b' : (isInside ? '#10b981' : '#3b82f6');
      const circle = L.circle([task.latitude, task.longitude], {
        radius: task.radius_meters || 100,
        color: circleColor,
        fillColor: circleColor,
        fillOpacity: isInside ? 0.25 : 0.1,
        weight: isInside ? 2 : 1
      });

      // Marker Popup
      const popupHtml = `
        <div class="popup-task-card">
          <div class="popup-title">${this.escapeHtml(task.title)}</div>
          ${task.description ? `<div class="popup-desc">${this.escapeHtml(task.description)}</div>` : ''}
          <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 6px;">
            Radius: ${task.radius_meters || 100}m
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);

      this.taskMarkersGroup.addLayer(marker);
      this.taskCirclesGroup.addLayer(circle);
    });
  }

  focusTaskOnMap(task) {
    this.map.flyTo([task.latitude, task.longitude], 16, { duration: 1.2 });
  }

  /* ==========================================================================
     6. High-Precision Geocoding & Auto-Complete Engine
     ========================================================================== */
  buildGeocodeUrl(query) {
    let url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&extratags=1&namedetails=1&limit=6&q=${encodeURIComponent(query)}`;

    // Proximity bias: if user location is available, bound search near user
    if (this.userLocation) {
      const delta = 0.5; // ~50km viewbox
      const viewbox = [
        (this.userLocation.lng - delta).toFixed(4),
        (this.userLocation.lat + delta).toFixed(4),
        (this.userLocation.lng + delta).toFixed(4),
        (this.userLocation.lat - delta).toFixed(4)
      ].join(',');
      url += `&viewbox=${viewbox}`;
    }
    return url;
  }

  async fetchSearchSuggestions(query) {
    try {
      const url = this.buildGeocodeUrl(query);
      const res = await fetch(url);
      const results = await res.json();

      if (results && results.length > 0) {
        this.renderSuggestions(results);
      } else {
        this.hideSuggestions();
      }
    } catch (e) {
      console.log('Suggestion error:', e);
    }
  }

  renderSuggestions(results) {
    this.addressSuggestions.innerHTML = '';
    this.addressSuggestions.classList.remove('hidden');

    results.forEach(item => {
      const div = document.createElement('div');
      div.className = 'suggestion-item';

      const titleName = item.namedetails?.name || item.name || item.display_name.split(',')[0];
      const subAddr = item.display_name.split(',').slice(1, 4).join(',').trim();
      const typeIcon = this.getCategoryIcon(item.type || item.class);

      div.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <i class="${typeIcon}" style="color: var(--accent-cyan);"></i>
          <div>
            <strong style="color: var(--text-primary); font-size: 0.9rem;">${this.escapeHtml(titleName)}</strong>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${this.escapeHtml(subAddr)}</div>
          </div>
        </div>
      `;

      div.addEventListener('click', () => {
        this.selectLocationItem(item);
      });

      this.addressSuggestions.appendChild(div);
    });
  }

  getCategoryIcon(type) {
    if (['ice_cream', 'fast_food', 'restaurant', 'cafe'].includes(type)) return 'fa-solid fa-ice-cream';
    if (['shop', 'supermarket', 'convenience', 'mall'].includes(type)) return 'fa-solid fa-cart-shopping';
    if (['park', 'leisure'].includes(type)) return 'fa-solid fa-tree';
    return 'fa-solid fa-location-dot';
  }

  hideSuggestions() {
    this.addressSuggestions.classList.add('hidden');
  }

  selectLocationItem(item) {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const placeName = item.namedetails?.name || item.name || item.display_name.split(',')[0];
    const fullAddr = item.display_name.split(',').slice(0, 3).join(',').trim();

    this.hideSuggestions();
    this.mapSearchInput.value = placeName;

    // Fly close-up to venue with level 17 precision
    this.map.flyTo([lat, lng], 17, { duration: 1.5 });

    // Drop temporary search marker
    if (this.searchMarker) this.map.removeLayer(this.searchMarker);

    const pinIcon = L.divIcon({
      className: 'custom-task-pin inside-pin',
      html: `<i class="fa-solid fa-star"></i>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36]
    });

    this.searchMarker = L.marker([lat, lng], { icon: pinIcon }).addTo(this.map);
    this.searchMarker.bindPopup(`<b>${this.escapeHtml(placeName)}</b><br><small>${this.escapeHtml(fullAddr)}</small>`).openPopup();

    // Pre-fill Task Modal
    this.openTaskModal({ lat, lng });
    this.taskTitleInput.value = `Visit ${placeName}`;
    this.taskAddressInput.value = fullAddr;
  }

  async searchMapAddress(query) {
    if (!query || query.length < 2) return;

    try {
      const url = this.buildGeocodeUrl(query);
      const res = await fetch(url);
      const results = await res.json();

      if (results && results.length > 0) {
        this.selectLocationItem(results[0]);
      } else {
        alert('Location not found. Try adding a city name (e.g. "Handel\'s Ice Cream Long Beach")');
      }
    } catch (e) {
      console.log('Geocode search error:', e);
    }
  }

  async forwardGeocodeModal(address) {
    try {
      const url = this.buildGeocodeUrl(address);
      const res = await fetch(url);
      const results = await res.json();

      if (results && results.length > 0) {
        const top = results[0];
        const lat = parseFloat(top.lat);
        const lng = parseFloat(top.lon);
        this.taskLatInput.value = lat.toFixed(6);
        this.taskLngInput.value = lng.toFixed(6);
        this.taskAddressInput.value = top.display_name.split(',').slice(0, 3).join(',').trim();
        this.map.flyTo([lat, lng], 17, { duration: 1.2 });
      }
    } catch (e) {
      console.log('Modal geocode error:', e);
    }
  }

  async reverseGeocode(lat, lng) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.display_name) {
        const titleName = data.namedetails?.name || data.name || data.display_name.split(',')[0];
        const fullAddr = data.display_name.split(',').slice(0, 3).join(',').trim();
        this.taskAddressInput.value = fullAddr;
        if (!this.taskTitleInput.value) {
          this.taskTitleInput.value = `Visit ${titleName}`;
        }
      }
    } catch (e) {
      console.log('Reverse geocode error:', e);
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m]));
  }
}

// Initialize Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.geoTaskApp = new GeoTaskApp();
});
