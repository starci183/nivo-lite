import type { EnvSource } from "@modules/platform/config"
import type { QdrantConfig } from "./qdrant.options"

/**
 * Reads the Qdrant service from the environment: `QDRANT_URL` (no default: without it the app has no vector index and the meaning
 * search stays on Postgres; THIS is the one switch between the two stores), `QDRANT_API_KEY` (the one secret name it reads, sealed;
 * optional on a private network) and `QDRANT_TIMEOUT`. The vector size is not an environment value: the composition passes the
 * dimensions the app embeds with. The parse never refuses.
 */
export const parseQdrantConfig = (env: EnvSource): QdrantConfig => ({
    url: env.has("QDRANT_URL") ? env.url("QDRANT_URL").replace(/\/$/u, "") : null,
    apiKey: env.has("QDRANT_API_KEY") ? env.secret("QDRANT_API_KEY") : null,
    timeoutMs: env.duration("QDRANT_TIMEOUT", 5000),
})
