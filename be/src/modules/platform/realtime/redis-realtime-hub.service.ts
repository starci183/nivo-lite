import { Injectable } from "@nestjs/common"
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { Timer } from "@modules/platform/retry"
import {
    InjectRealtimeTimer,
    InjectRedisPublisher,
    InjectRedisRealtimeOptions,
    InjectRedisSubscriber,
} from "./realtime.decorators"
import type { RedisRealtimeOptions } from "./realtime.options"
import type { RedisConnection } from "./redis-realtime.port"
import { RedisReloadingHubService } from "./redis-reloading-hub.service"

@Injectable()
/**
 * The shared push hub of an app with N api replicas on Redis. Writing and replay are in the replay base, following the Pub/Sub channel
 * and the recovery after a lost subscriber connection in the reloading base; this class stops reloading, ends the open subscriptions and
 * closes both connections when the app shuts down.
 */
export class RedisRealtimeHubService extends RedisReloadingHubService implements OnModuleInit, OnModuleDestroy {
    constructor(
        @InjectRedisPublisher() publisher: RedisConnection,
        @InjectRedisSubscriber() subscriber: RedisConnection,
        @InjectRedisRealtimeOptions() options: RedisRealtimeOptions,
        @InjectLogger() logger: Logger,
        @InjectRealtimeTimer() timer: Timer,
    ) {
        super(publisher, subscriber, options, logger, timer)
    }

    /** Stops reloading, lets a reload already queued settle, ends the open subscriptions, then closes both connections. */
    async onModuleDestroy(): Promise<void> {
        this.started = false
        this.cancelRetry()
        await this.reloading
        this.subscriptions.close()
        await Promise.all([this.subscriber.quit(), this.publisher.quit()])
    }
}
