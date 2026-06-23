import { useState, useEffect } from "react";

const MEDIA_CACHE_NAME = "ripple-media-cache-v1";
const MAX_CACHE_ITEMS = 150;

/**
 * Checks if a URL is valid for caching (must be a web http/https URL)
 */
function isValidUrl(url: string | undefined): boolean {
  if (!url) return false;
  if (url.startsWith("data:") || url.startsWith("blob:")) return false;
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/");
}

/**
 * Download and cache a media URL
 */
export async function downloadAndCache(url: string): Promise<boolean> {
  if (!isValidUrl(url)) return false;

  try {
    if (!("caches" in window)) return false;

    const cache = await window.caches.open(MEDIA_CACHE_NAME);
    const cachedResponse = await cache.match(url);

    if (cachedResponse) {
      return true; // Already cached
    }

    // Fetch and store
    const response = await fetch(url);
    if (!response.ok) return false;

    await cache.put(url, response);
    
    // Periodically clean up cache if it exceeds limit
    limitCacheSize();
    return true;
  } catch (error) {
    console.warn("[MediaCache] Failed to download and cache URL:", url, error);
    return false;
  }
}

/**
 * Clean up old cache items to prevent memory/disk bloating
 */
async function limitCacheSize() {
  try {
    if (!("caches" in window)) return;
    const cache = await window.caches.open(MEDIA_CACHE_NAME);
    const keys = await cache.keys();
    if (keys.length > MAX_CACHE_ITEMS) {
      // Delete the oldest items
      const toDelete = keys.slice(0, keys.length - MAX_CACHE_ITEMS);
      for (const key of toDelete) {
        await cache.delete(key);
      }
      console.log(`[MediaCache] Cleaned up ${toDelete.length} old cached assets.`);
    }
  } catch (err) {
    console.error("[MediaCache] Error cleaning up cache:", err);
  }
}

/**
 * Hook to retrieve a cached local blob URL or original URL
 */
export function useCachedUrl(url: string | undefined): string | undefined {
  const [cachedUrl, setCachedUrl] = useState<string | undefined>(url);

  useEffect(() => {
    if (!url) {
      setCachedUrl(undefined);
      return;
    }

    if (!isValidUrl(url)) {
      setCachedUrl(url);
      return;
    }

    let isMounted = true;
    let objectUrl: string | null = null;

    async function load() {
      try {
        if (!("caches" in window)) {
          if (isMounted) setCachedUrl(url);
          return;
        }

        const cache = await window.caches.open(MEDIA_CACHE_NAME);
        const cachedResponse = await cache.match(url);

        if (cachedResponse) {
          const blob = await cachedResponse.blob();
          objectUrl = URL.createObjectURL(blob);
          if (isMounted) {
            setCachedUrl(objectUrl);
          }
          return;
        }

        // If not cached, return original URL immediately so it loads,
        // and trigger prefetch in background
        if (isMounted) {
          setCachedUrl(url);
        }

        // Prefetch and cache in background
        downloadAndCache(url).then((success) => {
          if (success && isMounted) {
            // Re-fetch from cache and update to local blob for snappy performance
            cache.match(url).then(async (res) => {
              if (res && isMounted) {
                const blob = await res.blob();
                const newObjUrl = URL.createObjectURL(blob);
                if (isMounted) {
                  // Revoke the old objectUrl before setting a new one if it changed
                  if (objectUrl) {
                    URL.revokeObjectURL(objectUrl);
                  }
                  objectUrl = newObjUrl;
                  setCachedUrl(newObjUrl);
                }
              }
            });
          }
        });
      } catch (err) {
        if (isMounted) {
          setCachedUrl(url);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url]);

  return cachedUrl;
}

/**
 * Hook to prefetch multiple media URLs in the background
 */
export function usePrefetchPostMedia(mediaUrls: string[]) {
  useEffect(() => {
    if (!mediaUrls || mediaUrls.length === 0) return;

    // Prefetch all media in background after a tiny delay
    const timer = setTimeout(() => {
      mediaUrls.forEach((url) => {
        if (url) {
          downloadAndCache(url);
        }
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [mediaUrls]);
}
