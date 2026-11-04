import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emailConfigured, sendEmail, senderAddress } from "../src/email";

const originalFetch = globalThis.fetch;

type Call = { url: string; method: string; body: string };

let calls: Call[] = [];
let tokenStatus = 200;
let sendStatus = 202;
let resendStatus = 200;

function installFetchMock(): void {
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: String(init?.body ?? "") });

    if (url.startsWith("https://login.microsoftonline.com/")) {
      if (tokenStatus !== 200) {
        return Response.json({ error: "invalid_client" }, { status: tokenStatus });
      }
      return Response.json({ access_token: "graph-token", expires_in: 3600 });
    }
    if (url.startsWith("https://graph.microsoft.com/v1.0/users/")) {
      if (sendStatus !== 202) {
        return Response.json({ error: { code: "ErrorAccessDenied" } }, { status: sendStatus });
      }
      return new Response(null, { status: 202 });
    }
    if (url === "https://api.resend.com/emails") {
      if (resendStatus !== 200) return Response.json({ message: "nope" }, { status: resendStatus });
      return Response.json({ id: "email-id" });
    }
    return originalFetch(input, init);
  };
}

const message = {
  to: "ada@example.com",
  subject: "Your server is ready",
  text: "plain body",
  html: "<p>html body</p>",
};

function graphEnv(overrides: Record<string, string> = {}): Env {
  return {
    ...env,
    MS_GRAPH_TENANT_ID: "tenant-id",
    MS_GRAPH_CLIENT_ID: "client-id",
    MS_GRAPH_CLIENT_SECRET: "client-secret",
    EMAIL_FROM: "OpenGameNode <hello@opengamenode.com>",
    ...overrides,
  } as Env;
}

beforeEach(() => {
  calls = [];
  tokenStatus = 200;
  sendStatus = 202;
  resendStatus = 200;
  installFetchMock();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("email", () => {
  it("parses the sender address out of EMAIL_FROM", () => {
    expect(senderAddress("OpenGameNode <hello@opengamenode.com>")).toBe("hello@opengamenode.com");
    expect(senderAddress("hello@opengamenode.com")).toBe("hello@opengamenode.com");
    expect(senderAddress("")).toBe("");
    expect(senderAddress("not an address")).toBe("");
  });

  it("sends through Microsoft Graph with an app-only token", async () => {
    const outcome = await sendEmail(graphEnv(), message);
    expect(outcome).toEqual({ ok: true });

    const tokenCall = calls[0]!;
    expect(tokenCall.url).toBe("https://login.microsoftonline.com/tenant-id/oauth2/v2.0/token");
    const tokenBody = new URLSearchParams(tokenCall.body);
    expect(tokenBody.get("grant_type")).toBe("client_credentials");
    expect(tokenBody.get("scope")).toBe("https://graph.microsoft.com/.default");
    expect(tokenBody.get("client_secret")).toBe("client-secret");

    const sendCall = calls[1]!;
    expect(sendCall.url).toBe("https://graph.microsoft.com/v1.0/users/hello%40opengamenode.com/sendMail");
    expect(sendCall.method).toBe("POST");
    expect(JSON.parse(sendCall.body)).toEqual({
      message: {
        subject: "Your server is ready",
        body: { contentType: "HTML", content: "<p>html body</p>" },
        toRecipients: [{ emailAddress: { address: "ada@example.com" } }],
      },
      saveToSentItems: false,
    });
  });

  it("reuses a cached token for later sends", async () => {
    await sendEmail(graphEnv({ MS_GRAPH_TENANT_ID: "cached-tenant" }), message);
    await sendEmail(graphEnv({ MS_GRAPH_TENANT_ID: "cached-tenant" }), message);
    const tokenCalls = calls.filter((call) => call.url.includes("login.microsoftonline.com"));
    expect(tokenCalls).toHaveLength(1);
    expect(calls.filter((call) => call.url.includes("sendMail"))).toHaveLength(2);
  });

  it("reports a rejected token without throwing", async () => {
    tokenStatus = 401;
    expect(await sendEmail(graphEnv({ MS_GRAPH_TENANT_ID: "reject-tenant" }), message)).toEqual({
      ok: false,
      reason: "graph_token_http_401",
    });
    expect(calls.some((call) => call.url.includes("sendMail"))).toBe(false);
  });

  it("reports a refused send so the row can be retried", async () => {
    sendStatus = 403;
    expect(await sendEmail(graphEnv({ MS_GRAPH_TENANT_ID: "denied-tenant" }), message)).toEqual({
      ok: false,
      reason: "graph_http_403",
    });
  });

  it("falls back to Resend when Microsoft 365 is not configured", async () => {
    const resendEnv = {
      ...env,
      MS_GRAPH_TENANT_ID: "",
      MS_GRAPH_CLIENT_ID: "",
      MS_GRAPH_CLIENT_SECRET: "",
      RESEND_API_KEY: "resend-key",
      EMAIL_FROM: "OpenGameNode <hello@opengamenode.com>",
    } as Env;
    expect(await sendEmail(resendEnv, message)).toEqual({ ok: true });
    expect(calls[0]!.url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(calls[0]!.body)).toMatchObject({
      from: "OpenGameNode <hello@opengamenode.com>",
      to: ["ada@example.com"],
    });
  });

  it("treats a missing sender as unconfigured", () => {
    const none = { ...env, MS_GRAPH_TENANT_ID: "", MS_GRAPH_CLIENT_ID: "", MS_GRAPH_CLIENT_SECRET: "" } as Env;
    expect(emailConfigured({ ...none, EMAIL_FROM: "", RESEND_API_KEY: "" } as Env)).toBe(false);
  });
});
