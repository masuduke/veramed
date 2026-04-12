const ALLOWED = ['BD','PK','IN','LK','NP','BT','MV','AF'];

export async function detectCountryFromIP(ip: string): Promise<string | null> {
  try {
    const clean = ip.replace('::ffff:', '');
    if (clean === '127.0.0.1' || clean === '::1') return 'BD';
    const res = await fetch('http://ip-api.com/json/' + clean + '?fields=countryCode');
    const data = await res.json() as any;
    return ALLOWED.includes(data.countryCode) ? data.countryCode : null;
  } catch { return null; }
}

export function isAllowedCountry(code: string | null): boolean {
  return ALLOWED.includes(code || '');
}

export async function geocodeAddress(address: {
  street?: string; city?: string; postcode?: string; country?: string;
}): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = [address.street, address.city, address.postcode, address.country].filter(Boolean).join(', ');
    const url = 'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(q) + '&format=json&limit=1';
    const res = await fetch(url, { headers: { 'User-Agent': 'VeraMed/1.0' } });
    const data = await res.json() as any[];
    if (!data?.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { return null; }
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export function calcDeliveryFee(
  patLat: number, patLng: number, pharLat: number, pharLng: number,
  pricing: { free_km: number; per_km_fee: number }
): { distanceKm: number; fee: number } {
  const distanceKm = haversineKm(patLat, patLng, pharLat, pharLng);
  const chargeableKm = Math.max(0, distanceKm - Number(pricing.free_km));
  const fee = Math.round(chargeableKm * Number(pricing.per_km_fee) * 100) / 100;
  return { distanceKm: Math.round(distanceKm * 10) / 10, fee };
}