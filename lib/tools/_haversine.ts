/**
 * Great-circle distance in meters between two lat/lng points.
 * Sufficient accuracy for "nearest responder" / "nearest help point" UX.
 */

export const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const haversineMeters = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number => {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);

  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLng = Math.sin(dLng / 2);

  const h =
    sinHalfLat * sinHalfLat +
    Math.cos(lat1) * Math.cos(lat2) * sinHalfLng * sinHalfLng;

  const c = 2 * Math.asin(Math.min(1, Math.sqrt(h)));

  return Math.round(EARTH_RADIUS_METERS * c);
};
