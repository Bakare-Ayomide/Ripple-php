/**
 * Resolves API and static asset URLs to absolute URLs on mobile platforms (Capacitor/Cordova)
 * while keeping relative paths or standard location origins for web deployment.
 */

// Production API URL for fallback on mobile
export const PRODUCTION_API_URL = "https://ripple.zerolord.com";

export function getApiBaseUrl(): string {
  if (typeof window === "undefined") return "";

  const origin = window.location.origin || "";
  
  const isLocalDev = 
    origin.includes(":3000") || 
    origin.includes(":5173") || 
    origin.includes(":5174") || 
    origin.includes(".run.app");

  const isMobileApp = 
    (window as any).Capacitor !== undefined ||
    (window as any).cordova !== undefined ||
    origin.startsWith("capacitor:") || 
    origin.startsWith("file:") || 
    origin.startsWith("local:") || 
    origin === "null" ||
    ((origin.startsWith("http://localhost") || origin.startsWith("https://localhost")) && !isLocalDev) ||
    (navigator.userAgent.toLowerCase().includes("android") && !isLocalDev);

  if (isMobileApp) {
    // Check if the user stored a custom API URL override in local storage
    const customUrl = localStorage.getItem("ripple_custom_api_url");
    if (customUrl) return customUrl;
    
    return PRODUCTION_API_URL;
  }

  // Otherwise, default to standard relative URL for web deployment
  const pathname = window.location.pathname || "";
  if (pathname.includes("/ripple")) {
    return "/ripple";
  }
  return "";
}

/**
 * Resolves any target path to either a relative URL (web) or fully-qualified absolute URL (mobile APK)
 */
export function resolveUrl(path: string): string {
  if (!path) return "";
  if (
    path.startsWith("http://") || 
    path.startsWith("https://") || 
    path.startsWith("data:") || 
    path.startsWith("blob:") ||
    path.startsWith("capacitor:")
  ) {
    return path;
  }
  
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
