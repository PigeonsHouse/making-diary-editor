export const DEFAULT_RENDER_APP_URL = "http://diary-web:3000";

export function resolveRenderAssetUrls<T>(value: T, appUrl = process.env.APP_URL ?? DEFAULT_RENDER_APP_URL): T {
  if (typeof value === "string") {
    return (value.startsWith("/api/") ? `${appUrl}${value}` : value) as T;
  }
  if (Array.isArray(value)) return value.map((item) => resolveRenderAssetUrls(item, appUrl)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveRenderAssetUrls(item, appUrl)]),
    ) as T;
  }
  return value;
}
