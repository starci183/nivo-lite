import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { VectorSyncQueue } from "./vector-sync.queue"

/** Token of the typed producer of the vector-sync queue. */
export const VECTOR_SYNC_QUEUE_PRODUCER: unique symbol = Symbol("queues.vector-sync.producer")

/** Injects the vector-sync queue producer. Parameter type: VectorSyncQueue. */
export const InjectVectorSyncQueue = (): TypedParameterDecorator<VectorSyncQueue> =>
    injector<VectorSyncQueue>(VECTOR_SYNC_QUEUE_PRODUCER)
