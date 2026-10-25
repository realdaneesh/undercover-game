// Socket.IO interprets URL paths as namespaces. Deployment URLs must be origins.
export function httpOrigin(value: string, requireHttps: boolean): string | null {
  try {
    const url = new URL(value.trim());
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      (requireHttps && url.protocol !== 'https:') ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      url.hostname.includes('*')
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
