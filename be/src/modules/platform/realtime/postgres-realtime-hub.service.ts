import { Injectable } from "@nestjs/common"
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { Timer } from "@modules/platform/retry"
import { PostgresReloadingHubService } from "./postgres-reloading-hub.service"
import type { NotificationListener } from "./postgres-listener.port"
import { InjectNotificationListener, InjectRealtimeManagers, InjectRealtimeTimer } from "./realtime.decorators"

@Injectable()
/**
 * The shared push hub of a lite deploy with N api replicas, stateless: Postgres is the only shared state, so no replica needs sticky
 * sessions or in-process state another replica would miss. Writing and replay are in the replay base, delivery and recovery after a lost
 * connection in the reloading base; this class ends the open subscriptions when the app shuts down.
 */
export class PostgresRealtimeHubService extends PostgresReloadingHubService implements OnModuleInit, OnModuleDestroy {
    constructor(
        @InjectRealtimeManagers() managers: ReadonlyArray<EntityManager>,
        @InjectNotificationListener() listener: NotificationListener,
        @InjectLogger() logger: Logger,
        @InjectRealtimeTimer() timer: Timer,
    ) {
        super(managers, listener, logger, timer)
    }

    /** Stops listening, lets the deliveries already queued settle, then ends the open subscriptions. */
    async onModuleDestroy(): Promise<void> {
        this.stopped = true
        this.cancelRetry()
        await this.listener.stop()
        await this.delivery
        this.subscriptions.close()
    }
}
