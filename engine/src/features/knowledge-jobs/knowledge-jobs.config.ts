import type { EnvSource } from "../../platform/config/env.source";

/** Injection token of the knowledge job settings. */
export const KNOWLEDGE_JOBS_OPTIONS = Symbol("KNOWLEDGE_JOBS_OPTIONS");

export type EmbeddingSettings = {
  /** Empty = embeddings unavailable: passages are stored without vectors (full-text search only), exactly like the web without a key. */
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
};

export type GoogleSettings = {
  readonly clientId: string;
  readonly clientSecret: string;
  /** GOOGLE_OAUTH_BASE: one base replacing accounts.google.com / oauth2.googleapis.com (a local fake). */
  readonly oauthBase: string | null;
};

export type KnowledgeJobsOptions = {
  readonly embedding: EmbeddingSettings;
  /** CHANNEL_TOKEN_KEY (32 bytes, base64): decrypts the workspace's Drive grant. null = private Drive links cannot be read by the engine. */
  readonly channelTokenKey: Buffer | null;
  /** null = no Google OAuth client: an expired Drive access token cannot be refreshed. */
  readonly google: GoogleSettings | null;
  /** GOOGLE_DRIVE_BASE (default the Drive v3 API). */
  readonly driveBase: string;
};

export const DEFAULT_EMBEDDING_MODEL = "qwen/qwen3-embedding-8b";

/**
 * The same variables the web reads (src/lib/knowledge/embed.ts, src/lib/channels.ts, src/lib/google-sheets-core.ts, drive-api.ts), with the same fallbacks.
 * Nothing here is required: a missing embedding key degrades to full-text search, a missing Drive key to "public links only".
 */
export const parseKnowledgeJobsConfig = (env: EnvSource): KnowledgeJobsOptions => {
  const raw = env.optional("CHANNEL_TOKEN_KEY");
  const key = raw ? Buffer.from(raw, "base64") : null;
  const clientId = env.optional("GOOGLE_OAUTH_CLIENT_ID") ?? env.optional("SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID") ?? "";
  const clientSecret = env.optional("GOOGLE_OAUTH_CLIENT_SECRET") ?? env.optional("SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET") ?? "";
  return {
    embedding: {
      apiKey: env.optional("EMBEDDING_API_KEY") ?? env.optional("OPENROUTER_API_KEY") ?? env.optional("OPENAI_API_KEY") ?? env.optional("DEEPSEEK_API_KEY") ?? "",
      baseUrl: (env.optionalUrl("EMBEDDING_BASE_URL", ["http:", "https:"]) ?? "https://openrouter.ai/api/v1").replace(/\/+$/, ""),
      model: env.optional("EMBEDDING_MODEL") ?? DEFAULT_EMBEDDING_MODEL,
    },
    channelTokenKey: key && key.length === 32 ? key : null,
    google: clientId && clientSecret
      ? {
          clientId, clientSecret,
          oauthBase: env.optionalUrl("GOOGLE_OAUTH_BASE", ["http:", "https:"]) ?? null,
        }
      : null,
    driveBase: env.optionalUrl("GOOGLE_DRIVE_BASE", ["http:", "https:"]) ?? "https://www.googleapis.com/drive/v3",
  };
};
