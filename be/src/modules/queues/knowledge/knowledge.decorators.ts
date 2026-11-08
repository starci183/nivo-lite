import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { KnowledgeQueue } from "./knowledge.queue"

/** Token of the typed producer for durable knowledge and public-document jobs. */
export const KNOWLEDGE_QUEUE_PRODUCER: unique symbol = Symbol("queues.knowledge.producer")

/** Injects the knowledge queue producer. Parameter type: KnowledgeQueue. */
export const InjectKnowledgeQueue = (): TypedParameterDecorator<KnowledgeQueue> =>
    injector<KnowledgeQueue>(KNOWLEDGE_QUEUE_PRODUCER)
