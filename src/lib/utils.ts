import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function filterHighestPatches<T extends { version: string }>(
  allReleases: T[],
  installedVersions: string[]
): T[] {
  const grouped = new Map<string, T>();
  
  allReleases.forEach(release => {
    const parts = release.version.split('.');
    if (parts.length >= 2) {
      const majorMinor = `${parts[0]}.${parts[1]}`;
      // Since allReleases should be sorted descending, the first one we see is the highest
      if (!grouped.has(majorMinor)) {
        grouped.set(majorMinor, release);
      }
    }
  });

  const finalReleases = new Map<string, T>();
  
  // Add highest patches
  grouped.forEach((release) => {
    finalReleases.set(release.version, release);
  });
  
  // Always include installed versions
  installedVersions.forEach(v => {
    const r = allReleases.find(rel => rel.version === v);
    if (r) {
      finalReleases.set(r.version, r);
    }
  });

  // Sort descending
  return Array.from(finalReleases.values()).sort((a, b) => {
     const pa = a.version.split('.').map(Number);
     const pb = b.version.split('.').map(Number);
     for(let i=0; i<Math.max(pa.length, pb.length); i++) {
        const numA = pa[i] || 0;
        const numB = pb[i] || 0;
        if (numA !== numB) return numB - numA;
     }
     return 0;
  });
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export async function fetchWithCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = localStorage.getItem(key);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_TTL) {
        return parsed.data as T;
      }
    } catch (e) {
      // ignore parse errors and fetch fresh
    }
  }

  const data = await fetcher();
  localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  return data;
}
