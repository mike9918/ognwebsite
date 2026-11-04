import { cleanText } from "./http";

// Minimal client for the Calagopus admin API. It mirrors the endpoints the
// official Paymenter module uses, so the shapes here follow its behaviour.
// The API key is an admin key: never log it, and never put it in a URL.

export type CalagopusConfig = {
  baseUrl: string;
  apiKey: string;
};

export type CalagopusUser = {
  uuid: string;
  username?: string;
  email?: string;
  external_id?: string | null;
};

export type CalagopusServer = {
  uuid: string;
  name?: string;
};

export type CalagopusEgg = {
  uuid: string;
  name?: string;
  docker_images?: Record<string, string> | string[];
  startup?: string;
  startup_commands?: Record<string, string>;
};

export type CalagopusEggVariable = {
  env_variable?: string;
  default_value?: string;
};

export type CalagopusAllocation = {
  uuid: string;
};

export class CalagopusError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CalagopusError";
    this.status = status;
  }
}

type Method = "GET" | "POST" | "PATCH";

async function errorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { errors?: unknown };
    if (!Array.isArray(body.errors)) return "";
    const text = body.errors
      .map((error) => {
        if (typeof error === "string") return error;
        if (error && typeof error === "object" && "detail" in error) {
          return String((error as { detail: unknown }).detail ?? "");
        }
        return "";
      })
      .filter(Boolean)
      .join(", ");
    return text ? `: ${cleanText(text, 200)}` : "";
  } catch {
    return "";
  }
}

async function request<T>(
  config: CalagopusConfig,
  method: Method,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers = new Headers({
    Authorization: `Bearer ${config.apiKey}`,
    Accept: "application/json",
  });
  if (body !== undefined) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new CalagopusError(0, "The Calagopus panel could not be reached.");
  }
  if (!response.ok) {
    throw new CalagopusError(
      response.status,
      `Calagopus rejected ${method} ${path.split("?")[0]} (HTTP ${response.status})${await errorDetail(response)}`,
    );
  }
  if (response.status === 204) return {} as T;
  try {
    return (await response.json()) as T;
  } catch {
    throw new CalagopusError(response.status, "The Calagopus panel returned an unreadable response.");
  }
}

export type PanelClient = {
  findUserByExternalId(externalId: string): Promise<CalagopusUser | null>;
  createUser(input: Record<string, unknown>): Promise<CalagopusUser>;
  searchUsers(search: string): Promise<CalagopusUser[]>;
  linkExternalId(userUuid: string, externalId: string): Promise<void>;
  linkOauth(userUuid: string, providerUuid: string, identifier: string): Promise<void>;
  getServerByExternalId(externalId: string): Promise<CalagopusServer | null>;
  getEgg(nestUuid: string, eggUuid: string): Promise<CalagopusEgg>;
  getEggVariables(nestUuid: string, eggUuid: string): Promise<CalagopusEggVariable[]>;
  getAvailableAllocations(nodeUuid: string, perPage?: number): Promise<CalagopusAllocation[]>;
  createServer(payload: Record<string, unknown>): Promise<CalagopusServer>;
  deployServer(payload: Record<string, unknown>): Promise<CalagopusServer>;
  serverUrl(serverUuid: string): string;
};

export function createPanelClient(config: CalagopusConfig): PanelClient {
  return {
    async findUserByExternalId(externalId) {
      try {
        const body = await request<{ user?: CalagopusUser }>(
          config,
          "GET",
          `/api/admin/users/external/${encodeURIComponent(externalId)}`,
        );
        return body.user ?? null;
      } catch (error) {
        if (error instanceof CalagopusError && error.status === 404) return null;
        throw error;
      }
    },

    async createUser(input) {
      const body = await request<{ user: CalagopusUser }>(config, "POST", "/api/admin/users", input);
      return body.user;
    },

    async searchUsers(search) {
      const query = new URLSearchParams({ page: "1", per_page: "10", search }).toString();
      const body = await request<{ users?: { data?: CalagopusUser[] } }>(
        config,
        "GET",
        `/api/admin/users?${query}`,
      );
      return body.users?.data ?? [];
    },

    async linkExternalId(userUuid, externalId) {
      await request<unknown>(config, "PATCH", `/api/admin/users/${userUuid}`, {
        external_id: externalId,
      });
    },

    async linkOauth(userUuid, providerUuid, identifier) {
      try {
        await request<unknown>(config, "POST", `/api/admin/users/${userUuid}/oauth_links`, {
          oauth_provider_uuid: providerUuid,
          identifier,
        });
      } catch (error) {
        // Already linked is the end state we want, so a duplicate is success.
        if (error instanceof CalagopusError && error.status === 409) return;
        throw error;
      }
    },

    async getServerByExternalId(externalId) {
      try {
        const body = await request<{ server?: CalagopusServer }>(
          config,
          "GET",
          `/api/admin/servers/external/${encodeURIComponent(externalId)}`,
        );
        return body.server ?? null;
      } catch (error) {
        if (error instanceof CalagopusError && error.status === 404) return null;
        throw error;
      }
    },

    async getEgg(nestUuid, eggUuid) {
      const body = await request<{ egg: CalagopusEgg }>(
        config,
        "GET",
        `/api/admin/nests/${nestUuid}/eggs/${eggUuid}`,
      );
      return body.egg;
    },

    async getEggVariables(nestUuid, eggUuid) {
      const body = await request<{ variables?: CalagopusEggVariable[] }>(
        config,
        "GET",
        `/api/admin/nests/${nestUuid}/eggs/${eggUuid}/variables`,
      );
      return body.variables ?? [];
    },

    async getAvailableAllocations(nodeUuid, perPage = 1) {
      const query = new URLSearchParams({ page: "1", per_page: String(perPage) }).toString();
      const body = await request<{ allocations?: { data?: CalagopusAllocation[] } }>(
        config,
        "GET",
        `/api/admin/nodes/${nodeUuid}/allocations/available?${query}`,
      );
      return body.allocations?.data ?? [];
    },

    async createServer(payload) {
      const body = await request<{ server: CalagopusServer }>(
        config,
        "POST",
        "/api/admin/servers",
        payload,
      );
      return body.server;
    },

    async deployServer(payload) {
      const body = await request<{ server: CalagopusServer }>(
        config,
        "POST",
        "/api/admin/servers/deploy",
        payload,
      );
      return body.server;
    },

    serverUrl(serverUuid) {
      return `${config.baseUrl}/server/${serverUuid}`;
    },
  };
}
