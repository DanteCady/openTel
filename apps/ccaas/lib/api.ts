export function getWsUrl(): string {
  if (typeof window === "undefined") return "ws://127.0.0.1:3001";
  const host =
    window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname;
  return `ws://${host}:3001`;
}

export function getApiUrl(): string {
  if (typeof window === "undefined") return "http://127.0.0.1:3000";
  return `${window?.location?.protocol ?? "http:"}//${window?.location?.hostname ?? "localhost"}:3000`;
}
