import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import type { CancelTimer, Timer } from "@modules/platform/retry"
import { readNotification } from "./realtime-notification.mapper"
import { CATCH_UP_ROWS, NOTIFY_CHANNEL, RECONNECT_DELAY_MS } from "./realtime.contracts"
import { InjectRealtimeTimer, InjectNotificationListener, InjectRealtimeManagers } from "./realtime.decorators"
import { RealtimeLogEvent } from "./realtime.log-events"
import { entryOf, PostgresReplayHubService } from "./postgres-replay-hub.service"
import type { NotificationListener } from "./postgres-listener.port"
import type { EventRow } from "./persistence/realtime.rows"
import { NOTIFY_PROBE, SELECT_EVENT, SELECT_MISSED_EVENTS } from "./persistence/realtime.sql"

@Injectable()
/**
 * The delivery and recovery half of the Postgres hub: it starts listening, loads the row a notification names and hands it to the subscriptions of
 * this replica in arrival order, holds notifications while the LISTEN connection is down, reloads each followed topic after the
 * oldest open receiver position and retries a failed reload before it releases the pause.
 */
export class PostgresReloadingHubService extends PostgresReplayHubService {
    protected delivery: Promise<void> = Promise.resolve()
    /** True from a lost connection until the reload after it finished; notifications of that time wait in `held`. */
    protected paused = false
    /** Counts the losses, so a reload that a newer loss overtook does not release the notifications of the newer connection. */
    protected generation = 0
    private readonly held: Array<string> = []
    protected cancelRetry: CancelTimer = () => undefined
    protected stopped = false

    constructor(
        @InjectRealtimeManagers() managers: ReadonlyArray<EntityManager>,
        @InjectNotificationListener() protected readonly listener: NotificationListener,
        @InjectLogger() protected readonly logger: Logger,
        @InjectRealtimeTimer() protected readonly timer: Timer,
    ) {
        super(managers)
    }

    /** Starts listening: only what is published from now on is delivered live, and a subscription replays what it names. */
    async onModuleInit(): Promise<void> {
        const writer = this.writer()
        await this.listener.start({
            notify: (payload) => this.chain(() => this.deliver(payload)),
            probe: async (payload) => {
                await writer.query(NOTIFY_PROBE, [NOTIFY_CHANNEL, payload])
            },
            lost: () => this.lost(),
            resumed: () => {
                const lossesSeen = this.generation
                this.chain(() => this.catchUp(lossesSeen))
            },
        })
    }

    /** Runs the work after the work before it: notifications are handled in the order they arrived, so frames of a topic keep their order. */
    protected chain(work: () => Promise<void>): void {
        this.delivery = this.delivery.then(work)
    }

    protected async deliver(payload: string): Promise<void> {
        if (this.paused) this.held.push(payload)
        else {
            try {
                await this.deliverNow(payload)
            } catch (cause) {
                this.logger.error(RealtimeLogEvent.DeliveryFailed, cause)
                this.lost()
                const lossesSeen = this.generation
                this.chain(() => this.catchUp(lossesSeen))
            }
        }
    }

    /** Loads a notified row; each receiver drops positions its replay or a prior delivery already covered. */
    private async deliverNow(payload: string): Promise<void> {
        const notification = readNotification(payload)
        if (notification === undefined) {
            this.logger.warn(RealtimeLogEvent.NotificationIgnored)
            return
        }
        if (!this.subscriptions.follows(notification.topic)) return
        const rows = await this.writer().query<Array<EventRow>>(SELECT_EVENT, [notification.seq])
        this.subscriptions.fanOut(rows.map(entryOf))
    }

    /** Holds delivery until the current loss has been recovered; an older scheduled retry no longer owns the pause. */
    protected lost(): void {
        this.cancelRetry()
        this.generation += 1
        this.paused = true
    }

    /**
     * Reloads what the followed topics missed while the connection was down, then lets the held notifications through. A reload that a
     * newer loss overtook leaves the pause to the reload of that newer loss.
     */
    protected async catchUp(lossesSeen: number): Promise<void> {
        if (this.stopped || lossesSeen !== this.generation) return
        try {
            await this.reload()
        } catch (cause) {
            this.logger.error(RealtimeLogEvent.CatchUpFailed, cause)
            if (!this.stopped && lossesSeen === this.generation) {
                this.cancelRetry()
                this.cancelRetry = this.timer.schedule(
                    () => this.chain(() => this.catchUp(lossesSeen)),
                    RECONNECT_DELAY_MS,
                )
            }
            return
        }
        if (!this.stopped && lossesSeen === this.generation) {
            this.cancelRetry()
            this.paused = false
            await this.drain()
        }
    }

    private async reload(): Promise<void> {
        await this.reloadFrom(this.subscriptions.topics(), new Map<string, number>())
    }

    /** Reads every missed batch; local pagination also progresses while a receiver still holds entries behind its initial replay. */
    private async reloadFrom(topics: ReadonlyArray<string>, loaded: Map<string, number>): Promise<void> {
        const followed = topics.filter((topic) => this.subscriptions.follows(topic))
        if (followed.length === 0) return
        const rows = await this.writer().query<Array<EventRow>>(SELECT_MISSED_EVENTS, [
            followed,
            followed.map((topic) => Math.max(Number(this.subscriptions.floorOf(topic)), loaded.get(topic) ?? 0)),
            CATCH_UP_ROWS,
        ])
        const entries = rows.map(entryOf)
        this.subscriptions.fanOut(entries)
        for (const entry of entries) loaded.set(entry.topic, Number(entry.position))
        if (rows.length === CATCH_UP_ROWS) await this.reloadFrom(followed, loaded)
    }

    private async drain(): Promise<void> {
        await eachInOrder(this.held.splice(0), (payload) => this.deliver(payload))
    }
}
