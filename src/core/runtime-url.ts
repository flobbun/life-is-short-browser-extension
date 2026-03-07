export function getExtensionUrl(path: string): string | null {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const runtime = browser.runtime as typeof browser.runtime & {
    id?: string;
    getURL: (url: string) => string;
  };

  if (!runtime.id) {
    return null;
  }

  const url = runtime.getURL(normalizedPath);
  if (url.includes('://invalid/')) {
    return null;
  }

  return url;
}
