import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import type { CancelTimer, Timer } from "@modules/platform/retry"
import { readHubMessage } from "./redis-envelope.mapper"
import { RECONNECT_DELAY_MS } from "./realtime.contracts"
import {
    InjectRealtimeTimer,
    InjectRedisPublisher,
    InjectRedisRealtimeOptions,
    InjectRedisSubscriber,
} from "./realtime.decorators"
import { RealtimeLogEvent } from "./realtime.log-events"
import type { RedisRealtimeOptions } from "./realtime.options"
import type { RedisConnection } from "./redis-realtime.port"
import { RedisReplayHubService, retainedOf } from "./redis-replay-hub.service"

@Injectable()
/**
 * The delivery and recovery half of the Redis hub: it hands each Pub/Sub message to the subscriptions of this replica, holds the live
 * messages while the subscriber connection is coming back, reads each followed topic from the oldest position its open receivers
 * still need and retries a failed reload before it releases the pause. Each receiver drops positions it already took.
 */
export class RedisReloadingHubService extends RedisReplayHubService {
    protected readonly held: Array<string> = []
    protected started = false
    protected paused = false
    /** Counts the reconnects, so a reload that a newer reconnect overtook does not release the messages of the newer connection. */
    protected generation = 0
    protected reloading: Promise<void> = Promise.resolve()
    protected cancelRetry: CancelTimer = () => undefined

    constructor(
        @InjectRedisPublisher() publisher: RedisConnection,
        @InjectRedisSubscriber() protected readonly subscriber: RedisConnection,
        @InjectRedisRealtimeOptions() options: RedisRealtimeOptions,
        @InjectLogger() protected readonly logger: Logger,
        @InjectRealtimeTimer() protected readonly timer: Timer,
    ) {
        super(publisher, options)
    }

    protected receive(message: string): void {
        if (this.paused) this.held.push(message)
        else this.deliver(message)
    }

    /** Starts following the hub channel. */
    async onModuleInit(): Promise<void> {
        for (const connection of [this.publisher, this.subscriber]) {
            connection.on("error", (cause) => this.logger.warn(RealtimeLogEvent.RedisFailed, { cause: cause.message }))
        }
        this.subscriber.on("message", (_channel, message) => this.receive(message))
        this.subscriber.on("ready", () => this.reconnected())
        await this.subscriber.subscribe(this.options.prefix)
        this.started = true
    }

    /** Hands a message to its topic's receivers; each receiver drops positions it already took. */
    protected deliver(message: string): void {
        const entry = readHubMessage(message)
        if (entry === undefined) {
            this.logger.warn(RealtimeLogEvent.NotificationIgnored)
            return
        }
        this.subscriptions.fanOut([entry])
    }

    /** The subscriber connection came back: hold the live messages and reload what the followed topics missed. */
    protected reconnected(): void {
        if (!this.started) return
        this.cancelRetry()
        this.generation += 1
        this.paused = true
        const reconnects = this.generation
        this.reloading = this.reloading.then(() => this.reload(reconnects))
    }

    /**
     * Subscribes again (idempotent, so the channel is certainly followed before the streams are read), reloads each followed topic, then
     * lets the held messages through. A reload that a newer reconnect overtook leaves the pause to the reload of that newer reconnect.
     */
    protected async reload(reconnects: number): Promise<void> {
        try {
            await this.subscriber.subscribe(this.options.prefix)
            await eachInOrder(this.subscriptions.topics(), (topic) => this.reloadTopic(topic))
        } catch (cause) {
            this.logger.error(RealtimeLogEvent.CatchUpFailed, cause)
            if (this.started && reconnects === this.generation) {
                this.cancelRetry = this.timer.schedule(() => {
                    if (!this.started || reconnects !== this.generation) return
                    this.reloading = this.reloading.then(() => this.reload(reconnects))
                }, RECONNECT_DELAY_MS)
            }
            return
        }
        if (reconnects === this.generation) {
            this.paused = false
            for (const message of this.held.splice(0)) this.deliver(message)
        }
    }

    protected async reloadTopic(topic: string): Promise<void> {
        const floor = this.subscriptions.floorOf(topic)
        if (floor === undefined) return
        const reply = await this.publisher.xrange(this.keyOf(topic), `(${floor}`, "+")
        const entries = retainedOf(topic, reply).map((retained) => retained.entry)
        this.subscriptions.fanOut(entries)
    }
}
