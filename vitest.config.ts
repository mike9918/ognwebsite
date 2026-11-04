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
          DISCORD_BOT_TOKEN: "test-bot-token",
          DISCORD_GUILD_ID: "123456789012345678",
          DISCORD_INVITE_URL: "https://discord.gg/example",
          PUBLIC_ORIGIN: "https://opengamenode.com",
          CALAGOPUS_URL: "https://panel.test",
          CALAGOPUS_API_KEY: "test-panel-key",
          CALAGOPUS_NEST_UUID: "11111111-1111-4111-8111-111111111111",
          CALAGOPUS_EGG_VANILLA: "33333333-3333-4333-8333-333333333333",
          CALAGOPUS_EGG_PLUGINS: "77777777-7777-4777-8777-777777777777",
          CALAGOPUS_EGG_MODPACK: "22222222-2222-4222-8222-222222222222",
          CALAGOPUS_NODE_UUID: "",
          CALAGOPUS_LOCATION_UUIDS: "66666666-6666-4666-8666-666666666666",
          RESEND_API_KEY: "test-resend-key",
          EMAIL_FROM: "OpenGameNode <hello@opengamenode.com>",
        },
      },
    }),
  ],
}));
