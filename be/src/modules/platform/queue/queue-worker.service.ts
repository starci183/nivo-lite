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
 * The consuming side of the queues: the registry the processors fill, and the workers and schedulers started when the app has registered
 * every handler. One worker reads a queue and routes each delivery to the handler of its job (else the handler of the whole queue); a job
 * no handler names ends at once. A scheduler that cannot be registered is logged and does not stop the app: the next boot upserts it again.
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

    /** Starts one worker per registered queue (unless the consumer is off), then registers the schedulers of the options. */
    async onApplicationBootstrap(): Promise<void> {
        if (this.options.enabled) await eachInOrder(this.queues(), (queue) => this.work(queue))
        else this.logger.warn(QueueLogEvent.ConsumerDisabled, { queues: this.queues() })
        await eachInOrder(this.options.schedulers, (scheduler) =>
            this.transport.upsertScheduler(scheduler).catch((cause: unknown) => {
                this.logger.error(QueueLogEvent.SchedulerFailed, cause, { scheduler: scheduler.id })
            }),
        )
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
        return this.transport.work(
            router,
            Math.max(...own.map((handler) => handler.concurrency ?? this.options.concurrency)),
        )
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
