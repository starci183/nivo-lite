import type { EnvSource } from "./env.source";

export type HttpOptions = {
  readonly host: string;
  readonly port: number;
  /** The tool bridge base URL as OpenClaw reaches it (OpenClaw runs next to the engine; default loopback on the engine port). */
  readonly toolsUrl: string;
};

export const HTTP_OPTIONS = Symbol("HTTP_OPTIONS");

export const parseHttpConfig = (env: EnvSource): HttpOptions => {
  const port = env.int("ENGINE_PORT", 8787, { min: 1, max: 65_535 });
  return {
    host: env.optional("ENGINE_HOST") ?? "127.0.0.1",
    port,
    toolsUrl: env.optionalUrl("ENGINE_TOOLS_URL", ["http:", "https:"]) ?? `http://127.0.0.1:${port}`,
  };
};
