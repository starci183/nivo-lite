import { Injectable } from "@nestjs/common"
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { QueueError, QueueErrorCode } from "./errors/queue.error"
import type { QueueDelivery, QueueHandler } from "./queue.contracts"
import { InjectQueueOptions, InjectQueueTransport } from "./queue.decorators"
import { QueueLogEvent } from "./queue.log-events"
import type { QueueOptions } from "./queue.options"
import { routeOf } from "./queue.policy"
import type { QueueWorkerRegistry } from "./queue.port"
import type { QueueTransport } from "./queue-transport.port"

@Injectable()
/**
 * The consuming side of the queues: the registry the processors fill, and the workers started when the app has registered
 * every handler. One worker reads a queue and routes each delivery to the handler of its job (else the handler of the whole queue); a job
 * no handler names ends at once.
 */
export class QueueWorkerService implements QueueWorkerRegistry, OnApplicationBootstrap, OnApplicationShutdown {
    private readonly handlers: Array<QueueHandler> = []

    constructor(
        @InjectQueueOptions() private readonly options: QueueOptions,
        @InjectQueueTransport() private readonly transport: QueueTransport,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Registers the handler under the queue and job it names; a second handler for the same queue and job is a wiring bug. */
    add(handler: QueueHandler): void {
        if (this.handlers.some((known) => known.queue === handler.queue && known.job === handler.job)) {
            throw new QueueError({
                code: QueueErrorCode.HandlerDuplicated,
                params: { queue: handler.queue, job: handler.job ?? handler.queue },
            })
        }
        this.handlers.push(handler)
    }

    /** Starts one worker per registered queue (unless the consumer is off). */
    async onApplicationBootstrap(): Promise<void> {
        if (this.options.enabled) await eachInOrder(this.queues(), (queue) => this.work(queue))
        else this.logger.warn(QueueLogEvent.ConsumerDisabled, { queues: this.queues() })
    }

    /** Stops the workers and waits for the deliveries they run. */
    async onApplicationShutdown(): Promise<void> {
        await this.transport.close()
    }

    /** The queues that have a handler, once each. */
    private queues(): ReadonlyArray<string> {
        return [...new Set(this.handlers.map((handler) => handler.queue))]
    }

    /** Starts the worker of one queue with a router over its handlers; it runs as many deliveries as the busiest handler asks for. */
    private work(queue: string): Promise<void> {
        const own = this.handlers.filter((handler) => handler.queue === queue)
        const router: QueueHandler = {
            queue,
            handle: (delivery) => this.run(own, delivery),
            failed: (delivery, cause) => routeOf(own, delivery)?.failed?.(delivery, cause) ?? Promise.resolve(),
        }
        const concurrency = Math.max(...own.map((handler) => handler.concurrency ?? this.options.concurrency))
        return own.some((handler) => handler.scheduled === true)
            ? this.transport.workFires(router, concurrency)
            : this.transport.work(router, concurrency)
    }

    /** Runs the delivery on the handler it goes to; a job nobody handles fails with the error that archives it. */
    private run(handlers: ReadonlyArray<QueueHandler>, delivery: QueueDelivery): Promise<void> {
        const handler = routeOf(handlers, delivery)
        if (handler === undefined) {
            return Promise.reject(
                new QueueError({
                    code: QueueErrorCode.HandlerMissing,
                    params: { queue: delivery.queue, job: delivery.job },
                }),
            )
        }
        return handler.handle(delivery)
    }
}
