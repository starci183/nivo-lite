import type { Secret } from "@modules/platform/config"

/** How the app reaches its Qdrant service, as the environment says it. */
export interface QdrantConfig {
    /** The base address of the service, without a trailing slash. */
    readonly url: string
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

/** The endpoint the client calls: the options the module was registered with. */
export type QdrantEndpoint = QdrantOptions
