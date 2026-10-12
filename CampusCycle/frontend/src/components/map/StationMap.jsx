import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AVAILABILITY_STYLE } from '../../utils/domain';

/**
 * Leaflet + OpenStreetMap campus map.
 *
 * Markers are built with L.divIcon so no image assets are needed (Leaflet's
 * default marker icons break under a bundler without extra configuration).
 * Every number shown here comes from the backend station payload — nothing is
 * hard-coded in the frontend.
 */

const FALLBACK_CENTER = [20.5937, 78.9629]; // geographic centre of India
const FALLBACK_ZOOM = 5;

function stationIcon(station) {
  const style = AVAILABILITY_STYLE[station.availability_level] || AVAILABILITY_STYLE.INACTIVE;
  const count = station.available_count;
  const inactive = station.availability_level === 'INACTIVE';

  return L.divIcon({
    className: 'campuscycle-marker',
    html: `
      <div style="
        display:flex;align-items:center;justify-content:center;
        width:34px;height:34px;border-radius:9999px;
        background:${style.dot};color:#fff;
        font:600 13px/1 Inter,system-ui,sans-serif;
        border:2.5px solid #fff;
        box-shadow:0 1px 4px rgba(15,23,42,.35);
        ${inactive ? 'opacity:.75;' : ''}
      ">${inactive ? '—' : count}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

/** Fit the viewport to whatever is on the map, once the data arrives. */
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 16);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 17 });
  }, [map, points]);
  return null;
}

export default function StationMap({
  stations = [],
  geofence = null,
  bicycleLocations = [],
  height = 460,
  renderPopup,
  className = '',
}) {
  const stationPoints = useMemo(
    () =>
      stations
        .filter((s) => typeof s.latitude === 'number' && typeof s.longitude === 'number')
        .map((s) => [s.latitude, s.longitude]),
    [stations]
  );

  const boundaryPoints = useMemo(
    () => (geofence && Array.isArray(geofence.polygon) ? geofence.polygon : []),
    [geofence]
  );

  const bikePoints = useMemo(
    () =>
      bicycleLocations
        .filter((b) => typeof b.latitude === 'number' && typeof b.longitude === 'number')
        .map((b) => [b.latitude, b.longitude]),
    [bicycleLocations]
  );

  const allPoints = useMemo(
    () => [...stationPoints, ...boundaryPoints, ...bikePoints],
    [stationPoints, boundaryPoints, bikePoints]
  );

  const center = allPoints.length > 0 ? allPoints[0] : FALLBACK_CENTER;

  return (
    <div
      className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card ${className}`}
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={allPoints.length > 0 ? 16 : FALLBACK_ZOOM}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <FitBounds points={allPoints} />

        {boundaryPoints.length >= 3 && (
          <Polygon
            positions={boundaryPoints}
            pathOptions={{ color: '#059669', weight: 2, fillOpacity: 0.06, dashArray: '6 6' }}
          />
        )}

        {stations
          .filter((s) => typeof s.latitude === 'number' && typeof s.longitude === 'number')
          .map((station) => (
            <Marker
              key={station.id}
              position={[station.latitude, station.longitude]}
              icon={stationIcon(station)}
              alt={`${station.name} — ${station.available_count} of ${station.capacity} cycles available`}
            >
              <Popup minWidth={220}>{renderPopup ? renderPopup(station) : station.name}</Popup>
            </Marker>
          ))}

        {bicycleLocations
          .filter((b) => typeof b.latitude === 'number' && typeof b.longitude === 'number')
          .map((bike) => (
            <CircleMarker
              key={`bike-${bike.bicycle_id}`}
              center={[bike.latitude, bike.longitude]}
              radius={7}
              pathOptions={{
                color: bike.inside_boundary === false ? '#e11d48' : '#2563eb',
                fillColor: bike.inside_boundary === false ? '#e11d48' : '#2563eb',
                fillOpacity: 0.85,
                weight: 2,
              }}
            >
              <Popup minWidth={200}>
                <div className="text-sm">
                  <p className="font-semibold text-slate-900">{bike.bicycle_code}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Last simulated position
                    {bike.inside_boundary === false ? ' — outside the campus boundary' : ''}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-400">
                    {bike.latitude.toFixed(6)}, {bike.longitude.toFixed(6)}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
      </MapContainer>
    </div>
  );
}
