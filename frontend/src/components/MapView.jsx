import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Custom Map Pins
const liveIcon = L.divIcon({
  className: 'custom-live-marker',
  html: `<div style="background:#06b6d4;width:16px;height:16px;border-radius:50%;border:3px solid #ffffff;box-shadow:0 0 12px #06b6d4;animation:pulse 1.5s infinite;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

const greenPin = L.divIcon({
  className: 'custom-green-marker',
  html: `<div style="background:#10b981;width:14px;height:14px;border-radius:50%;border:2px solid #ffffff;box-shadow:0 0 8px #10b981;"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

const redPin = L.divIcon({
  className: 'custom-red-marker',
  html: `<div style="background:#ef4444;width:16px;height:16px;border-radius:50%;border:2px solid #ffffff;box-shadow:0 0 10px #ef4444;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

function MapBounds({ markers }) {
  const map = useMap();
  useEffect(() => {
    const valid = markers.filter(m => m && typeof m.lat === 'number' && typeof m.lng === 'number');
    if (valid.length > 0) {
      if (valid.length === 1) {
        map.setView([valid[0].lat, valid[0].lng], 15);
      } else {
        const bounds = L.latLngBounds(valid.map(m => [m.lat, m.lng]));
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    }
  }, [map, markers]);
  return null;
}

const parseCoord = (val, fallback) => {
  const num = parseFloat(val);
  return (!isNaN(num) && isFinite(num)) ? num : fallback;
};

export default function MapView({ center, zoom = 14, currentLocation, origin, destination, routeWaypoints = [] }) {
  const defaultLat = parseCoord(center ? center[0] : (currentLocation?.lat || origin?.lat), 28.6139);
  const defaultLng = parseCoord(center ? center[1] : (currentLocation?.lng || origin?.lng), 77.2090);
  const markers = [currentLocation, origin, destination].filter(m => m && typeof m.lat === 'number' && !isNaN(m.lat) && typeof m.lng === 'number' && !isNaN(m.lng));

  return (
    <div className="w-full h-full min-h-[220px] rounded-xl overflow-hidden glass-card relative z-0">
      <MapContainer 
        center={[defaultLat, defaultLng]} 
        zoom={zoom} 
        style={{ height: '100%', width: '100%', minHeight: '220px', background: '#0e1626' }}
        scrollWheelZoom={true}
      >
        {/* CartoDB Dark Matter Free Map Tiles */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap'
        />

        {origin && typeof origin.lat === 'number' && (
          <Marker position={[origin.lat, origin.lng]} icon={greenPin} />
        )}
        {destination && typeof destination.lat === 'number' && (
          <Marker position={[destination.lat, destination.lng]} icon={redPin} />
        )}
        {currentLocation && typeof currentLocation.lat === 'number' && (
          <Marker position={[currentLocation.lat, currentLocation.lng]} icon={liveIcon} />
        )}

        {routeWaypoints && routeWaypoints.length > 1 && (
          <Polyline 
            positions={routeWaypoints.map(w => [w.lat, w.lng])} 
            color="#06b6d4" 
            weight={4} 
            opacity={0.8}
          />
        )}

        <MapBounds markers={markers} />
      </MapContainer>
    </div>
  );
}
