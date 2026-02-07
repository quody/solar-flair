// ============================================================
// SolarFlair — Light Pollution Tile utilities
// Fetches Lorenz 2024 LP atlas tiles, decodes pixel data,
// maps to Bortle class and continuous viewing factor.
// ============================================================

const TILE_SIZE = 1024;
const TILE_ZOOM = 6;
const tileCache = new Map<string, ImageData | null>();

function latLonToTile(
  lat: number,
  lon: number,
  zoom: number
): { x: number; y: number } {
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      n
  );
  return { x, y };
}

function latLonToPixelInTile(
  lat: number,
  lon: number,
  zoom: number
): { tileX: number; tileY: number; px: number; py: number } {
  const n = 2 ** zoom;
  const xFloat = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yFloat =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    n;

  const tileX = Math.floor(xFloat);
  const tileY = Math.floor(yFloat);
  const px = Math.floor((xFloat - tileX) * TILE_SIZE);
  const py = Math.floor((yFloat - tileY) * TILE_SIZE);

  return { tileX, tileY, px, py };
}

async function fetchTileImageData(
  x: number,
  y: number
): Promise<ImageData | null> {
  const key = `${x}_${y}`;
  if (tileCache.has(key)) return tileCache.get(key) ?? null;

  try {
    const url = `https://djlorenz.github.io/astronomy/image_tiles/tiles2024/tile_${TILE_ZOOM}_${x}_${y}.png`;
    const res = await fetch(url);
    if (!res.ok) {
      tileCache.set(key, null);
      return null;
    }
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      tileCache.set(key, null);
      return null;
    }
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    tileCache.set(key, imageData);
    return imageData;
  } catch {
    tileCache.set(key, null);
    return null;
  }
}

function pixelToLpFactor(imageData: ImageData, px: number, py: number): number {
  const clampedPx = Math.min(px, imageData.width - 1);
  const clampedPy = Math.min(py, imageData.height - 1);
  const idx = (clampedPy * imageData.width + clampedPx) * 4;
  const r = imageData.data[idx];
  const g = imageData.data[idx + 1];
  const b = imageData.data[idx + 2];
  const lightness = (r + g + b) / (3 * 255);

  // Map lightness to Bortle-based factor
  // Dark (low lightness) = good for viewing (high factor)
  // Bright (high lightness) = bad for viewing (low factor)
  if (lightness < 0.05) return 1.0; // Bortle 1-2
  if (lightness < 0.15) return 0.8; // Bortle 3
  if (lightness < 0.25) return 0.6; // Bortle 4
  if (lightness < 0.4) return 0.4; // Bortle 5
  if (lightness < 0.55) return 0.25; // Bortle 6
  if (lightness < 0.7) return 0.15; // Bortle 7
  if (lightness < 0.85) return 0.08; // Bortle 8
  return 0.03; // Bortle 9
}

function pixelToBortle(imageData: ImageData, px: number, py: number): number {
  const clampedPx = Math.min(px, imageData.width - 1);
  const clampedPy = Math.min(py, imageData.height - 1);
  const idx = (clampedPy * imageData.width + clampedPx) * 4;
  const r = imageData.data[idx];
  const g = imageData.data[idx + 1];
  const b = imageData.data[idx + 2];
  const lightness = (r + g + b) / (3 * 255);

  if (lightness < 0.05) return 1;
  if (lightness < 0.1) return 2;
  if (lightness < 0.15) return 3;
  if (lightness < 0.25) return 4;
  if (lightness < 0.4) return 5;
  if (lightness < 0.55) return 6;
  if (lightness < 0.7) return 7;
  if (lightness < 0.85) return 8;
  return 9;
}

/* ---------- Public API ---------- */

export function sampleLpSync(
  lat: number,
  lon: number
): { factor: number; bortle: number } | null {
  if (lat < -65 || lat > 75) return null;
  const { tileX, tileY, px, py } = latLonToPixelInTile(lat, lon, TILE_ZOOM);
  const key = `${tileX}_${tileY}`;
  const imageData = tileCache.get(key);
  if (!imageData) return null;
  return {
    factor: pixelToLpFactor(imageData, px, py),
    bortle: pixelToBortle(imageData, px, py),
  };
}

export async function sampleLpAsync(
  lat: number,
  lon: number
): Promise<{ factor: number; bortle: number }> {
  if (lat < -65 || lat > 75) return { factor: 1.0, bortle: 1 };
  const { tileX, tileY, px, py } = latLonToPixelInTile(lat, lon, TILE_ZOOM);
  const imageData = await fetchTileImageData(tileX, tileY);
  if (!imageData) return { factor: 1.0, bortle: 1 };
  return {
    factor: pixelToLpFactor(imageData, px, py),
    bortle: pixelToBortle(imageData, px, py),
  };
}

export async function prefetchTilesForBounds(
  south: number,
  west: number,
  north: number,
  east: number
): Promise<void> {
  const minTile = latLonToTile(north, west, TILE_ZOOM);
  const maxTile = latLonToTile(south, east, TILE_ZOOM);

  const promises: Promise<ImageData | null>[] = [];
  for (let x = minTile.x; x <= maxTile.x; x++) {
    for (let y = minTile.y; y <= maxTile.y; y++) {
      promises.push(fetchTileImageData(x, y));
    }
  }
  await Promise.allSettled(promises);
}

export function bortleLabel(bortle: number): string {
  const labels: Record<number, string> = {
    1: "Excellent Dark",
    2: "Typical Dark",
    3: "Rural Sky",
    4: "Rural/Suburban",
    5: "Suburban Sky",
    6: "Bright Suburban",
    7: "Suburban/Urban",
    8: "City Sky",
    9: "Inner City",
  };
  return labels[bortle] ?? "Unknown";
}
