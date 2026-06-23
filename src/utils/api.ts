/**
 * Resolves a URL based on the environment and relative subdirectories.
 */
export function resolveUrl(path: string): string {
  if (typeof window === "undefined") {
    return path;
  }

  const isRippleSubdir = window.location.pathname.startsWith("/ripple");
  const base = isRippleSubdir ? "/ripple" : "";

  // If the path starts with a slash, prefix with base
  if (path.startsWith("/")) {
    return `${base}${path}`;
  }

  return path;
}
