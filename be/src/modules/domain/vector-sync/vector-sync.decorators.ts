import type { VectorKind, VectorRowSource } from "@modules/integrations/qdrant"
import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { VectorDriftReporter, VectorEmbedder } from "./vector-sync.contracts"

/** The Postgres side of each kind of point. */
export type VectorRowSources = Readonly<Record<VectorKind, VectorRowSource>>

/** Token of the Postgres side of each kind of point. */
export const VECTOR_ROW_SOURCES: unique symbol = Symbol("domain.vector-sync.sources")

/** Token of the embedding door the sync uses. */
export const VECTOR_EMBEDDER: unique symbol = Symbol("domain.vector-sync.embedder")

/** Token of where a drift is told, or of null when the app binds no report (the mcp gateway). */
export const VECTOR_DRIFT_REPORTER: unique symbol = Symbol("domain.vector-sync.drift-reporter")

/** Injects where a drift is told, or null. Parameter type: VectorDriftReporter | null. */
export const InjectVectorDriftReporter = (): TypedParameterDecorator<VectorDriftReporter | null> =>
    injector<VectorDriftReporter | null>(VECTOR_DRIFT_REPORTER)

/** Injects the Postgres side of each kind of point. Parameter type: VectorRowSources. */
export const InjectVectorRowSources = (): TypedParameterDecorator<VectorRowSources> =>
    injector<VectorRowSources>(VECTOR_ROW_SOURCES)

/** Injects the embedding door of the sync. Parameter type: VectorEmbedder. */
export const InjectVectorEmbedder = (): TypedParameterDecorator<VectorEmbedder> => injector<VectorEmbedder>(VECTOR_EMBEDDER)
