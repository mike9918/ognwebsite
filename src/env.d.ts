// The Calagopus and email settings are managed in the Cloudflare dashboard
// (locally in .dev.vars), so the generated Env type cannot know them. Every
// value is optional: a missing one leaves provisioning disabled instead of
// breaking the site, and `keep_vars` keeps the values across deploys.
interface Env {
  CALAGOPUS_URL?: string;
  CALAGOPUS_NEST_UUID?: string;
  CALAGOPUS_EGG_VANILLA?: string;
  CALAGOPUS_EGG_PLUGINS?: string;
  CALAGOPUS_EGG_MODPACK?: string;
  // A node wins over locations; locations are comma-separated for auto-deploy.
  CALAGOPUS_NODE_UUID?: string;
  CALAGOPUS_LOCATION_UUIDS?: string;
  EMAIL_FROM?: string;
  // Optional: channel for the "new waitlist entry" card. Without it the bot
  // looks up a text channel named "waitlist" in the guild, once per isolate.
  DISCORD_WAITLIST_CHANNEL_ID?: string;
  CALAGOPUS_API_KEY?: string;
  // Microsoft 365 / Exchange Online app-only sending (preferred).
  MS_GRAPH_TENANT_ID?: string;
  MS_GRAPH_CLIENT_ID?: string;
  MS_GRAPH_CLIENT_SECRET?: string;
  // Standalone fallback when Microsoft 365 is not configured.
  RESEND_API_KEY?: string;
}
