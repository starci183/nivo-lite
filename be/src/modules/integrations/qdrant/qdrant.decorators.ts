import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { VectorIndex } from "./qdrant.contracts"
import type { QdrantEndpoint } from "./qdrant.options"

/** Token of the vector index (the Qdrant client), or of null when the deployment has no Qdrant service. */
export const VECTOR_INDEX: unique symbol = Symbol("integrations.qdrant")

/** Token of what prepares the collections, or of null when the deployment has no Qdrant service. */
export const VECTOR_INDEX_BOOT: unique symbol = Symbol("integrations.qdrant.boot")

/** Token of the endpoint the client calls. */
export const QDRANT_ENDPOINT: unique symbol = Symbol("integrations.qdrant.endpoint")

/** Token of the options the module was registered with. */
export const QDRANT_OPTIONS: unique symbol = Symbol("integrations.qdrant.options")

/** What prepares the collections of the index: asked before a run that writes to it. */
export interface VectorIndexBoot {
    /** Prepares the collections when this process has not yet; answers whether they are prepared. Only a size mismatch throws. */
    prepare(): Promise<boolean>
}

/** Injects the endpoint. Parameter type: QdrantEndpoint. */
export const InjectQdrantEndpoint = (): TypedParameterDecorator<QdrantEndpoint> => injector<QdrantEndpoint>(QDRANT_ENDPOINT)

/** Injects the vector index, or null when the deployment has none. Parameter type: VectorIndex | null. */
export const InjectVectorIndex = (): TypedParameterDecorator<VectorIndex | null> => injector<VectorIndex | null>(VECTOR_INDEX)

/** Injects what prepares the collections, or null when the deployment has no index. Parameter type: VectorIndexBoot | null. */
export const InjectVectorIndexBoot = (): TypedParameterDecorator<VectorIndexBoot | null> =>
    injector<VectorIndexBoot | null>(VECTOR_INDEX_BOOT)
