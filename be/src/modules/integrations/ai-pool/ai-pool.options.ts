import type { Secret } from "@modules/platform/config"

/** One key of a provider: the name telemetry shows and the secret it stands for. */
export interface AiPoolKey {
    /** The name of the key in logs and health: the env name it came from, or `<provider>-<n>`; never the secret. */
    readonly alias: string
    /** The key itself, read once at boot (a `<KEY>_FILE` mount included). */
    readonly secret: Secret
}

/** One OpenAI-compatible endpoint of the pool: where it is, the keys that reach it and the models it is asked for. */
export interface AiPoolProvider {
    /** The provider id in the router: `deepseek`, `openrouter` or `embeddings`. */
    readonly id: string
    /** The base URL the OpenAI paths hang from, without a trailing slash. */
    readonly baseUrl: string
    /** The keys; empty when the deployment has none, and the provider then takes no part in the pool. */
    readonly keys: ReadonlyArray<AiPoolKey>
    /** The model every call to this provider asks for. */
    readonly model: string
    /** The slower reasoning model the provider also serves, or null. */
    readonly smartModel: string | null
}

/** The AI pool: the chat providers in order of preference and the embeddings provider. */
export interface AiPoolOptions {
    /** DeepSeek first, then the OpenRouter-compatible fallback; a provider without keys is skipped. */
    readonly chat: ReadonlyArray<AiPoolProvider>
    /** The embeddings endpoint (OpenRouter or a local Ollama); without a key search falls back to keywords. */
    readonly embedding: AiPoolProvider
}
