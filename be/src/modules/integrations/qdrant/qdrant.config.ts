import type { EnvSource } from "@modules/platform/config"
import type { QdrantConfig } from "./qdrant.options"

/**
 * Reads the Qdrant service from the environment: `QDRANT_URL` (REQUIRED: the vector index is a required engine piece and the only
 * home of vectors; a deployment without it refuses to start with `CONFIG_KEY_MISSING`), `QDRANT_API_KEY` (the one secret name it
 * reads, sealed; optional on a private network) and `QDRANT_TIMEOUT`. The vector size is not an environment value: the composition
 * passes the dimensions the app embeds with.
 */
export const parseQdrantConfig = (env: EnvSource): QdrantConfig => ({
    url: env.url("QDRANT_URL").replace(/\/$/u, ""),
    apiKey: env.has("QDRANT_API_KEY") ? env.secret("QDRANT_API_KEY") : null,
    timeoutMs: env.duration("QDRANT_TIMEOUT", 5000),
})
