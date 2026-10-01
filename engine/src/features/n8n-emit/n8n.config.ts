import type { EnvSource } from "../../platform/config/env.source";

export type N8nOptions = {
  /** Used when a job names no URLs, for example the n8n service inside the compose network: http://n8n:5678/webhook/nivo-events */
  readonly defaultWebhookUrl: string | undefined;
  /** Hosts allowed even though they are private (the n8n service name). Everything else must resolve to a public address. */
  readonly allowedHosts: ReadonlyArray<string>;
  readonly timeoutMs: number;
};

export const N8N_OPTIONS = Symbol("N8N_OPTIONS");

export const parseN8nConfig = (env: EnvSource): N8nOptions => ({
  defaultWebhookUrl: env.optionalUrl("N8N_DEFAULT_WEBHOOK_URL", ["http:", "https:"]),
  allowedHosts: env.list("N8N_ALLOWED_HOSTS"),
  timeoutMs: env.int("N8N_EMIT_TIMEOUT_MS", 10_000, { min: 1000, max: 60_000 }),
});
