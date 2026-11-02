import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { GenericWebhookQueue } from "./generic-webhook.queue"

/** Token of the producer that durably queues a verified generic webhook receipt. */
export const GENERIC_WEBHOOK_QUEUE_PRODUCER: unique symbol = Symbol("queues.generic-webhook.producer")

/** Injects the generic webhook producer. Parameter type: GenericWebhookQueue. */
export const InjectGenericWebhookQueue = (): TypedParameterDecorator<GenericWebhookQueue> =>
    injector<GenericWebhookQueue>(GENERIC_WEBHOOK_QUEUE_PRODUCER)
