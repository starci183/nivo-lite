import type { EnvSource } from "../config/env.source";

export type OpenclawAuth = { readonly kind: "token"; readonly token: string } | { readonly kind: "password"; readonly password: string };

export type OpenclawOptions = {
  /** Null = OpenClaw is not configured: every chat.turn takes the direct-model fallback (the engine still runs n8n and health jobs). */
  readonly gateway: { readonly url: string; readonly auth: OpenclawAuth } | null;
  readonly turnTimeoutMs: number;
  /** Directory holding openclaw.json and the agent workspaces, as the ENGINE sees the shared volume (/openclaw-state). Agent sync needs it. */
  readonly configDir: string | undefined;
  /** The same directory as the GATEWAY sees it (/home/node/.openclaw): the `workspace` paths written into openclaw.json use this one. */
  readonly gatewayStateDir: string;
  /** Register synced agents in openclaw.json (`agents.list`). Needs configDir. */
  readonly manageAgents: boolean;
};

export const OPENCLAW_OPTIONS = Symbol("OPENCLAW_OPTIONS");

export const parseOpenclawConfig = (env: EnvSource): OpenclawOptions => {
  const url = env.optionalUrl("OPENCLAW_GATEWAY_URL", ["ws:", "wss:"]);
  const token = env.optional("OPENCLAW_GATEWAY_TOKEN");
  const password = env.optional("OPENCLAW_GATEWAY_PASSWORD");
  const auth: OpenclawAuth | null = token ? { kind: "token", token } : password ? { kind: "password", password } : null;
  return {
    gateway: url && auth ? { url, auth } : null,
    turnTimeoutMs: env.int("OPENCLAW_TURN_TIMEOUT_MS", 90_000, { min: 5000, max: 600_000 }),
    configDir: env.optional("OPENCLAW_CONFIG_DIR"),
    gatewayStateDir: (env.optional("OPENCLAW_GATEWAY_STATE_DIR") ?? "/home/node/.openclaw").replace(/\/+$/, ""),
    manageAgents: env.bool("OPENCLAW_MANAGE_AGENTS", false),
  };
};
