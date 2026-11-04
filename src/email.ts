export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type EmailOutcome = { ok: true } | { ok: false; reason: string };

// Exchange Online (Microsoft 365) is the preferred sender: the domain is
// already verified there, so no extra sending domain is needed. Graph rejects
// mailbox passwords and basic SMTP auth is retired, so this uses an app-only
// client-credentials token with Mail.Send.
type GraphConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  sender: string;
};

type ResendConfig = {
  apiKey: string;
  from: string;
};

// EMAIL_FROM is either "Name <address>" or a bare address. Graph needs the
// address itself for the /users/{id}/sendMail path.
export function senderAddress(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  const angled = value.match(/<([^<>\s]+@[^<>\s]+)>/);
  if (angled?.[1]) return angled[1].trim();
  return /^[^\s@]+@[^\s@]+$/.test(value) ? value : "";
}

function graphConfig(env: Env): GraphConfig | null {
  const tenantId = (env.MS_GRAPH_TENANT_ID ?? "").trim();
  const clientId = (env.MS_GRAPH_CLIENT_ID ?? "").trim();
  const clientSecret = (env.MS_GRAPH_CLIENT_SECRET ?? "").trim();
  const sender = senderAddress(env.EMAIL_FROM);
  if (!tenantId || !clientId || !clientSecret || !sender) return null;
  return { tenantId, clientId, clientSecret, sender };
}

function resendConfig(env: Env): ResendConfig | null {
  const apiKey = (env.RESEND_API_KEY ?? "").trim();
  const from = (env.EMAIL_FROM ?? "").trim();
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export function emailConfigured(env: Env): boolean {
  return graphConfig(env) !== null || resendConfig(env) !== null;
}

// A token is valid for about an hour. Caching it per isolate avoids a token
// round trip for every send; a miss just fetches a new one.
let tokenCache: { key: string; token: string; expiresAt: number } | null = null;

async function graphToken(
  config: GraphConfig,
): Promise<{ ok: true; token: string } | { ok: false; reason: string }> {
  const key = `${config.tenantId}:${config.clientId}`;
  if (tokenCache && tokenCache.key === key && tokenCache.expiresAt > Date.now()) {
    return { ok: true, token: tokenCache.token };
  }
  let response: Response;
  try {
    response = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch {
    console.error(JSON.stringify({ event: "provision_email_token_failed", status: 0 }));
    return { ok: false, reason: "graph_token_network" };
  }
  if (!response.ok) {
    console.error(JSON.stringify({ event: "provision_email_token_failed", status: response.status }));
    return { ok: false, reason: `graph_token_http_${response.status}` };
  }
  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) return { ok: false, reason: "graph_token_missing" };
  const ttl = typeof body.expires_in === "number" ? body.expires_in : 3599;
  tokenCache = {
    key,
    token: body.access_token,
    expiresAt: Date.now() + Math.max(60, ttl - 120) * 1000,
  };
  return { ok: true, token: body.access_token };
}

async function sendWithGraph(config: GraphConfig, message: EmailMessage): Promise<EmailOutcome> {
  const token = await graphToken(config);
  if (!token.ok) return token;
  try {
    // saveToSentItems is false so provisioning notifications do not pile up in
    // the sender's Sent Items. Graph returns 202 Accepted.
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.sender)}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject: message.subject,
            body: { contentType: "HTML", content: message.html },
            toRecipients: [{ emailAddress: { address: message.to } }],
          },
          saveToSentItems: false,
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) {
      console.error(
        JSON.stringify({ event: "provision_email_failed", provider: "graph", status: response.status }),
      );
      return { ok: false, reason: `graph_http_${response.status}` };
    }
    return { ok: true };
  } catch {
    console.error(JSON.stringify({ event: "provision_email_failed", provider: "graph", status: 0 }));
    return { ok: false, reason: "graph_network_or_timeout" };
  }
}

async function sendWithResend(config: ResendConfig, message: EmailMessage): Promise<EmailOutcome> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error(
        JSON.stringify({ event: "provision_email_failed", provider: "resend", status: response.status }),
      );
      return { ok: false, reason: `email_http_${response.status}` };
    }
    return { ok: true };
  } catch {
    console.error(JSON.stringify({ event: "provision_email_failed", provider: "resend", status: 0 }));
    return { ok: false, reason: "email_network_or_timeout" };
  }
}

// Microsoft 365 wins when it is configured; Resend is the standalone fallback.
// Only HTTP status codes are logged: addresses and bodies never reach the logs.
export async function sendEmail(env: Env, message: EmailMessage): Promise<EmailOutcome> {
  const graph = graphConfig(env);
  if (graph) return sendWithGraph(graph, message);
  const resend = resendConfig(env);
  if (resend) return sendWithResend(resend, message);
  return { ok: false, reason: "email_not_configured" };
}
