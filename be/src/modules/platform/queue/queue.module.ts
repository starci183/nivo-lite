import { QueueTimeoutService } from "./queue-timeout.service"
import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { QUEUE_OUTBOX, QUEUE_STATUS, QUEUE_TIMEOUT, QUEUE_TRANSPORT, QUEUE_WORKER_REGISTRY } from "./queue.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./queue.module-definition"
import { PgmqQueueTransportClient } from "./pgmq-queue-transport.client"
import { QueueOutboxService } from "./queue-outbox.service"
import { QueueWorkerService } from "./queue-worker.service"
import { QueueStatusService } from "./queue-status.service"

@Module({})
/** The queues of an app over Supabase Queues (pgmq): the outbox writer, the workers, registered once per app over the primary connection. */
export class QueueModule extends ConfigurableModuleClass {
    /** Registers the capability once per app that enqueues or processes jobs. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: QUEUE_TIMEOUT, useClass: QueueTimeoutService },
                PgmqQueueTransportClient,
                { provide: QUEUE_TRANSPORT, useExisting: PgmqQueueTransportClient },
                QueueOutboxService,
                QueueWorkerService,
                QueueStatusService,
                { provide: QUEUE_STATUS, useExisting: QueueStatusService },
                { provide: QUEUE_OUTBOX, useExisting: QueueOutboxService },
                { provide: QUEUE_WORKER_REGISTRY, useExisting: QueueWorkerService },
            ],
            exports: [QUEUE_TIMEOUT, QUEUE_OUTBOX, QUEUE_WORKER_REGISTRY, QUEUE_TRANSPORT, QUEUE_STATUS],
        }
    }
}
