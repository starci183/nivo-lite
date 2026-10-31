import { QueueTimeoutService } from "./queue-timeout.service"
import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { createRedisBackend, withBackend } from "bullmq"
import {
    QUEUE_FACTORY,
    QUEUE_OUTBOX,
    QUEUE_SCHEDULES,
    QUEUE_STATUS,
    QUEUE_TIMEOUT,
    QUEUE_TRANSPORT,
    QUEUE_WORKER_REGISTRY,
} from "./queue.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./queue.module-definition"
import { BullmqQueueDeliveryClient } from "./bullmq-queue-delivery.client"
import { BullmqQueueTransportClient } from "./bullmq-queue-transport.client"
import { QueueOutboxService } from "./queue-outbox.service"
import { QueueRelayService } from "./queue-relay.service"
import { QueueWorkerService } from "./queue-worker.service"
import { QueueStatusService } from "./queue-status.service"
import type { QueueFactory } from "./queue-transport.port"

/** Bind the queue capability to Redis without changing process-wide driver defaults. */
const { Queue, Worker } = withBackend(createRedisBackend)

/** The BullMQ objects the transport asks for, over the connection the app names. */
const bullmqFactory: QueueFactory = {
    queue: (name, options) => new Queue(name, { connection: options.connection, prefix: options.prefix }),
    worker: (name, processor, options) =>
        new Worker(name, (job, token) => processor(job, token), {
            connection: options.connection,
            prefix: options.prefix,
            concurrency: options.concurrency,
            lockDuration: options.lockDuration,
            settings: { backoffStrategy: (attemptsMade, _type, error) => options.backoffStrategy(attemptsMade, error) },
        }),
}

@Module({})
/** The queues of an app over BullMQ on Redis: the outbox writer, the committed-row relay and the workers, registered once per app. */
export class QueueModule extends ConfigurableModuleClass {
    /** Registers the capability once per app that enqueues or processes jobs. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: QUEUE_TIMEOUT, useClass: QueueTimeoutService },
                { provide: QUEUE_FACTORY, useValue: bullmqFactory },
                BullmqQueueDeliveryClient,
                BullmqQueueTransportClient,
                { provide: QUEUE_TRANSPORT, useExisting: BullmqQueueTransportClient },
                { provide: QUEUE_SCHEDULES, useExisting: BullmqQueueTransportClient },
                QueueOutboxService,
                QueueRelayService,
                QueueWorkerService,
                QueueStatusService,
                { provide: QUEUE_STATUS, useExisting: QueueStatusService },
                { provide: QUEUE_OUTBOX, useExisting: QueueOutboxService },
                { provide: QUEUE_WORKER_REGISTRY, useExisting: QueueWorkerService },
            ],
            exports: [
                QUEUE_TIMEOUT,
                QUEUE_OUTBOX,
                QUEUE_WORKER_REGISTRY,
                QUEUE_TRANSPORT,
                QUEUE_SCHEDULES,
                QUEUE_STATUS,
            ],
        }
    }
}
