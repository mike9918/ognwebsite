import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => ({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations("./migrations"),
          MIN_DISCORD_ACCOUNT_AGE_DAYS: "30",
          TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
          TURNSTILE_SECRET: "1x0000000000000000000000000000000AA",
          TURNSTILE_HOSTNAMES: "example.com",
          IP_HASH_SALT: "test-salt-value",
          ADMIN_TOKEN: "test-admin-token",
          ADMIN_DISCORD_IDS: "111222333444555666",
          DISCORD_CLIENT_ID: "discord-client",
          DISCORD_CLIENT_SECRET: "discord-secret",
          DISCORD_INVITE_URL: "https://discord.gg/example",
          PUBLIC_ORIGIN: "https://opengamenode.com",
        },
      },
    }),
  ],
}));
