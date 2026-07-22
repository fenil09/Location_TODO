# GeoTask - Location-Based TODO Frontend

This project contains the complete frontend for **GeoTask**, a location-based TODO and reminder web application.

The frontend is completely self-contained and ready to connect to any backend implementation (such as Python FastAPI + Firebase Firestore).

---

## 📁 Directory Structure

```
Location_TODO/
├── static/
│   ├── index.html        # Main Single Page Application interface
│   ├── css/styles.css    # Modern Dark Theme, Glassmorphism, & Map Styles
│   └── js/app.js         # Leaflet Map Engine, GPS Tracking, & LocalStorage/API Sync
└── README.md             # Project documentation & API contract
```

---

## 🛠️ Features Included in Frontend

- **Interactive Leaflet.js Map**: Click anywhere to pick location coordinates, view task pins, and customize geofence radiuses (20m to 2000m).
- **Live Geolocation Engine**: Browser `navigator.geolocation.watchPosition` updates user coordinates in real-time.
- **Distance & Geofence Logic**: Haversine distance calculations display distance badges ("45m away - INSIDE GEOFENCE").
- **Proximity Alerts**: Web Audio API chime sound effect + visual toast notifications when entering task radius.
- **Standby Mode**: Operates out-of-the-box using `localStorage` until your custom Python backend endpoints are ready!

---

## 🔌 API Contract (Endpoints to Implement in your Python Backend)

When you write your Python backend (e.g. using FastAPI), implement the following REST endpoints:

### Data Model Schema (`Todo`)
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "address_name": "San Francisco, CA",
  "radius_meters": 100,
  "completed": false,
  "created_at": "2026-07-21T18:00:00Z"
}
```

### Endpoints
1. `GET /api/todos` - Return list of all TODO items.
2. `POST /api/todos` - Create a new location-tagged TODO item.
3. `PATCH /api/todos/{id}` - Update a TODO item or toggle completion (`{"completed": true}`).
4. `DELETE /api/todos/{id}` - Delete a TODO item by ID.
