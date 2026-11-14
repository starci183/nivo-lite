import type { Secret } from "@modules/platform/config"

/** How the app reaches its Qdrant service, as the environment says it. */
export interface QdrantConfig {
    /** The base address of the service, without a trailing slash; null when the deployment has none (no client is registered). */
    readonly url: string | null
    /** The API key of the service, sealed; null for a service that asks for none (a private dev network). */
    readonly apiKey: Secret | null
    /** How long one call may take, milliseconds. */
    readonly timeoutMs: number
}

/** What the module is registered with: the environment's part and the vector size the app embeds with. */
export interface QdrantOptions extends QdrantConfig {
    /** The size of every vector: the dimensions of the embedding profile the app stores (the composition passes it). */
    readonly dimensions: number
}

/** The options of a deployment that has the service. */
export interface QdrantEndpoint extends QdrantOptions {
    /** The base address. */
    readonly url: string
}
