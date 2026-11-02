const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type SiteverifyResult = {
  success?: boolean;
  "error-codes"?: string[];
  action?: string;
  hostname?: string;
  metadata?: { result_with_testing_key?: boolean };
};

export async function verifyTurnstile(
  request: Request,
  env: Env,
  token: string,
): Promise<boolean> {
  const hostnames = new Set(
    env.TURNSTILE_HOSTNAMES.split(",")
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean),
  );
  if (!env.TURNSTILE_SECRET || hostnames.size === 0) return false;
  if (token.length === 0 || token.length > 2048) return false;

  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET,
    response: token,
  });
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) body.set("remoteip", ip);

  let result: SiteverifyResult;
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return false;
    result = (await response.json()) as SiteverifyResult;
  } catch {
    console.error(JSON.stringify({ event: "turnstile_unreachable" }));
    return false;
  }

  if (result.success !== true) {
    console.warn(
      JSON.stringify({
        event: "turnstile_rejected",
        errorCodes: result["error-codes"] ?? [],
      }),
    );
    return false;
  }
  if (!result.hostname || !hostnames.has(result.hostname.toLowerCase())) {
    console.warn(
      JSON.stringify({
        event: "turnstile_hostname",
        hostname: result.hostname ?? "",
      }),
    );
    return false;
  }
  if (result.action === "signup") return true;
  const testingKey = result.metadata?.result_with_testing_key === true;
  if (testingKey && (result.action === undefined || result.action === "")) return true;
  console.warn(JSON.stringify({ event: "turnstile_action", action: result.action ?? "" }));
  return false;
}
