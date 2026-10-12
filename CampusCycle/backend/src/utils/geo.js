'use strict';

/**
 * Geographic helpers for the campus map and the software geofence.
 *
 * Coordinates are plain [latitude, longitude] degree pairs. The campus is
 * small enough (about one square kilometre) that treating latitude/longitude
 * as a flat plane for point-in-polygon tests introduces no meaningful error.
 */

const MIN_POLYGON_VERTICES = 3;

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Coerce a value to a number, or return null when it is not numeric. */
function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function isValidLatitude(v) {
  return isFiniteNumber(v) && v >= -90 && v <= 90;
}

function isValidLongitude(v) {
  return isFiniteNumber(v) && v >= -180 && v <= 180;
}

/**
 * Validate a polygon: an array of at least three [lat, lng] pairs, each in
 * range. Returns the normalised polygon (numbers) or throws nothing — the
 * caller decides how to report `{ valid, reason, polygon }`.
 */
function validatePolygon(input) {
  if (!Array.isArray(input)) {
    return { valid: false, reason: 'Boundary must be an array of [latitude, longitude] pairs' };
  }
  if (input.length < MIN_POLYGON_VERTICES) {
    return { valid: false, reason: `Boundary needs at least ${MIN_POLYGON_VERTICES} points` };
  }

  const polygon = [];
  for (let i = 0; i < input.length; i += 1) {
    const pair = input[i];
    if (!Array.isArray(pair) || pair.length !== 2) {
      return { valid: false, reason: `Point ${i + 1} must be a [latitude, longitude] pair` };
    }
    const lat = toNumber(pair[0]);
    const lng = toNumber(pair[1]);
    if (!isValidLatitude(lat)) {
      return { valid: false, reason: `Point ${i + 1} has an invalid latitude (must be -90 to 90)` };
    }
    if (!isValidLongitude(lng)) {
      return { valid: false, reason: `Point ${i + 1} has an invalid longitude (must be -180 to 180)` };
    }
    polygon.push([lat, lng]);
  }
  return { valid: true, polygon };
}

/**
 * Ray-casting point-in-polygon test.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {Array<[number, number]>} polygon  [lat, lng] vertices
 * @returns {boolean} true when the point is inside (points exactly on an edge
 *                    may fall either way, which is acceptable for a campus
 *                    boundary alert).
 */
function isPointInPolygon(lat, lng, polygon) {
  if (!Array.isArray(polygon) || polygon.length < MIN_POLYGON_VERTICES) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [latI, lngI] = polygon[i];
    const [latJ, lngJ] = polygon[j];

    const straddles = latI > lat !== latJ > lat;
    if (!straddles) continue;

    const intersectLng = ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI;
    if (lng < intersectLng) inside = !inside;
  }
  return inside;
}

/** Bounding box of a polygon — handy for centring a map. */
function polygonBounds(polygon) {
  if (!Array.isArray(polygon) || polygon.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of polygon) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return {
    south: minLat,
    north: maxLat,
    west: minLng,
    east: maxLng,
    center: [(minLat + maxLat) / 2, (minLng + maxLng) / 2],
  };
}

module.exports = {
  MIN_POLYGON_VERTICES,
  toNumber,
  isValidLatitude,
  isValidLongitude,
  validatePolygon,
  isPointInPolygon,
  polygonBounds,
};
