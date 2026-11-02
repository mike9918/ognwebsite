const encoder = new TextEncoder();

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

export async function secretsMatch(provided: string, expected: string): Promise<boolean> {
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(left, right);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function canonicalOrigin(request: Request, configured: string): string {
  const fallback = new URL(request.url).origin;
  if (!configured) return fallback;
  try {
    const url = new URL(configured);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.username || url.password || url.search || url.hash) return fallback;
    if (url.pathname !== "/" && url.pathname !== "") return fallback;
    if (url.protocol !== "https:" && !local) return fallback;
    if (url.protocol !== "https:" && url.protocol !== "http:") return fallback;
    return url.origin;
  } catch {
    return fallback;
  }
}

export function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}

export function clientCountry(request: Request): string | null {
  const fromCf = request.cf && typeof request.cf.country === "string" ? request.cf.country : "";
  const header = request.headers.get("CF-IPCountry") ?? "";
  const value = (fromCf || header).toUpperCase();
  if (!/^[A-Z]{2}$/.test(value) || value === "XX" || value === "T1") return null;
  return value;
}

export function wantsJson(request: Request): boolean {
  return (request.headers.get("Accept") ?? "").includes("application/json");
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function setCookie(
  name: string,
  value: string,
  options: { maxAge: number; secure: boolean },
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${options.maxAge}`,
  ];
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearCookie(name: string, secure: boolean): string {
  return setCookie(name, "", { maxAge: 0, secure });
}

export function isSecure(request: Request): boolean {
  const forwarded = request.headers.get("X-Forwarded-Proto");
  if (forwarded) return forwarded.split(",")[0]?.trim() === "https";
  return new URL(request.url).protocol === "https:";
}

export function securityHeaders(): Record<string, string> {
  return {
    "Content-Security-Policy": [
      "default-src 'none'",
      "base-uri 'none'",
      // Discord OAuth: form POST to self then 302 to discord.com — Chrome applies
      // form-action to that redirect, which is why admin <a> worked and waitlist did not.
      "form-action 'self' https://discord.com",
      "frame-ancestors 'none'",
      "img-src 'self'",
      "font-src 'self'",
      "style-src 'self'",
      "script-src 'self' https://challenges.cloudflare.com",
      "frame-src https://challenges.cloudflare.com https://*.challenges.cloudflare.com",
      // Turnstile challenge workers use https + data: URLs for connect.
      "connect-src 'self' data: https://challenges.cloudflare.com https://*.challenges.cloudflare.com",
    ].join("; "),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}

// The Browser panel embeds a preview in a frame, which X-Frame-Options: DENY
// refuses with a blank page. Preview hosts are owner-only, so framing is allowed
// there; production hosts keep DENY and frame-ancestors 'none'.
const PREVIEW_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

function isPreviewHost(host: string): boolean {
  const name = host.trim().toLowerCase().replace(/:\d+$/, "");
  return PREVIEW_HOSTS.has(name) || name.endsWith(".style.dev") || name.endsWith(".workers.dev");
}

function isPreviewTraffic(request: Request): boolean {
  const host = request.headers.get("Host") ?? new URL(request.url).hostname;
  if (isPreviewHost(host)) return true;
  // wrangler dev rewrites the Host to the configured route, so the host cannot
  // identify a preview. Every request through the public origin carries the
  // Cloudflare edge marker; its absence means local dev or a preview proxy.
  return !request.headers.get("cf-ray");
}

export function relaxFramingForPreview(request: Request, response: Response): Response {
  if (!isPreviewTraffic(request)) return response;
  const headers = new Headers(response.headers);
  headers.delete("X-Frame-Options");
  const csp = headers.get("Content-Security-Policy");
  if (csp?.includes("frame-ancestors 'none'")) {
    headers.set("Content-Security-Policy", csp.replace("frame-ancestors 'none'", "frame-ancestors *"));
  }
  return new Response(response.body, { status: response.status, headers });
}

export function jsonScript(id: string, value: unknown): string {
  const json = JSON.stringify(value).replace(/</g, "\\u003c");
  return `<script type="application/json" id="${escapeHtml(id)}">${json}</script>`;
}

export function cleanText(value: string, max: number): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}
