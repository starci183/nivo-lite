import type { EnvSource } from "../config/env.source";

export type NivoOptions = {
  /** Base URL of the Next.js control plane, for example https://app.nivo.vn (local: http://127.0.0.1:3100). */
  readonly baseUrl: string;
  /** HMAC key shared with the app (ENGINE_SHARED_SECRET). Also the root of the tool-token and n8n signing keys. */
  readonly sharedSecret: string;
  readonly timeoutMs: number;
};

export const parseNivoConfig = (env: EnvSource): NivoOptions => ({
  baseUrl: env.url("NIVO_BASE_URL", ["http:", "https:"]),
  sharedSecret: env.secret("ENGINE_SHARED_SECRET", 32),
  timeoutMs: env.int("NIVO_TIMEOUT_MS", 55_000, { min: 1000, max: 300_000 }),
});

export const NIVO_OPTIONS = Symbol("NIVO_OPTIONS");
