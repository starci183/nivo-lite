import type { QueueTimeout } from "./queue-timeout.port"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { QueueOptions } from "./queue.options"
import type { QueueOutbox, QueueSchedules, QueueWorkerRegistry } from "./queue.port"
import type { QueueFactory, QueueTransport } from "./queue-transport.port"
import type { QueueStatusService } from "./queue-status.service"

/** Token of the options of the queues, exported so a spec can provide it. */
export const QUEUE_OPTIONS: unique symbol = Symbol("platform.queue.options")

/** Token of the QueueOutbox port. */
export const QUEUE_OUTBOX: unique symbol = Symbol("platform.queue.outbox")

/** Token of the registry a processor registers its queue handler with. */
export const QUEUE_WORKER_REGISTRY: unique symbol = Symbol("platform.queue.worker-registry")

/** Token of the authoritative queue status reader. */
export const QUEUE_STATUS: unique symbol = Symbol("platform.queue.status")

/** Token of the BullMQ transport port. */
export const QUEUE_TRANSPORT: unique symbol = Symbol("platform.queue.transport")

/** Token of the BullMQ object factory, exported so a spec can double the Redis boundary. */
export const QUEUE_FACTORY: unique symbol = Symbol("platform.queue.factory")

/** Injects the options of the queues. Parameter type: QueueOptions. */
export const InjectQueueOptions = (): TypedParameterDecorator<QueueOptions> => injector<QueueOptions>(QUEUE_OPTIONS)

/** Injects the QueueOutbox port. Parameter type: QueueOutbox. */
export const InjectQueueOutbox = (): TypedParameterDecorator<QueueOutbox> => injector<QueueOutbox>(QUEUE_OUTBOX)

/** Injects the worker registry. Parameter type: QueueWorkerRegistry. */
export const InjectQueueWorkerRegistry = (): TypedParameterDecorator<QueueWorkerRegistry> =>
    injector<QueueWorkerRegistry>(QUEUE_WORKER_REGISTRY)

/** Injects the BullMQ transport port. Parameter type: QueueTransport. */
export const InjectQueueTransport = (): TypedParameterDecorator<QueueTransport> =>
    injector<QueueTransport>(QUEUE_TRANSPORT)

/** Injects the BullMQ object factory. Parameter type: QueueFactory. */
export const InjectQueueFactory = (): TypedParameterDecorator<QueueFactory> => injector<QueueFactory>(QUEUE_FACTORY)

/** Injects the authoritative queue status reader. Parameter type: QueueStatusService. */
export const InjectQueueStatusService = (): TypedParameterDecorator<QueueStatusService> =>
    injector<QueueStatusService>(QUEUE_STATUS)

/** Token of the cancellable process-local deadline port. */
export const QUEUE_TIMEOUT: unique symbol = Symbol("platform.queue.timeout")

/** Injects the deadline port. Parameter type: QueueTimeout. */
export const InjectQueueTimeout = (): TypedParameterDecorator<QueueTimeout> => injector<QueueTimeout>(QUEUE_TIMEOUT)

/** Token of the registry of keyed job schedulers. */
export const QUEUE_SCHEDULES: unique symbol = Symbol("platform.queue.schedules")

/** Injects the registry of keyed job schedulers. Parameter type: QueueSchedules. */
export const InjectQueueSchedules = (): TypedParameterDecorator<QueueSchedules> =>
    injector<QueueSchedules>(QUEUE_SCHEDULES)
