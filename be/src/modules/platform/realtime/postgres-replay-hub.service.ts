import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { writerOf } from "./realtime-connection.policy"
import { RealtimeSubscriptionsPolicy } from "./realtime-subscriptions.policy"
import type { Entry, Replay } from "./realtime-subscriptions.policy"
import { NOTIFY_CHANNEL, REALTIME_LOCK_CLASS, REPLAY_FRAMES } from "./realtime.contracts"
import { InjectRealtimeManagers } from "./realtime.decorators"
import type { RealtimeTopic, RealtimeTransaction } from "./realtime.port"
import { SubscribedRealtimeHub } from "./subscribed-realtime-hub.service"
import type { EventRow, HighestSeqRow } from "./persistence/realtime.rows"
import { LOCK_TOPIC, PUBLISH_EVENT, SELECT_EVENTS_AFTER, SELECT_TOPIC_HIGHEST_SEQ } from "./persistence/realtime.sql"

/** The entry a loaded row stands for. */
export const entryOf = (row: EventRow): Entry => ({ position: row.seq, topic: row.topic, frame: row.payload })

/** Orders table sequence numbers, which the driver returns as text. */
const comparePositions = (left: string, right: string): number => Number(left) - Number(right)

/** The string `id` a frame carries, or null: only a frame with an id can be resumed after. */
const idOf = (frame: object): string | null => {
    const id: unknown = Reflect.get(frame, "id")
    return typeof id === "string" ? id : null
}

@Injectable()
/**
 * The write and replay half of the Postgres hub: `publish` writes the frame to `realtime_events` and NOTIFYs in one statement under a
 * topic lock, so the sequence order of a topic is its commit order, and a reconnect on any replica reads the frames it missed from the
 * table after its `Last-Event-ID`.
 */
export class PostgresReplayHubService extends SubscribedRealtimeHub {
    protected override readonly subscriptions = new RealtimeSubscriptionsPolicy(comparePositions, "0")

    constructor(@InjectRealtimeManagers() protected readonly managers: ReadonlyArray<EntityManager>) {
        super()
    }

    /**
     * Writes the frame (the retained replay row) and notifies every replica, under the topic lock. Inside the publisher's transaction
     * the frame commits and goes out with the publisher's own write; on its own it runs in a transaction of its own.
     */
    override async publish<T extends object>(
        topic: RealtimeTopic<T>,
        frame: T,
        within?: RealtimeTransaction,
    ): Promise<void> {
        const write = async (transaction: RealtimeTransaction): Promise<void> => {
            await transaction.query(LOCK_TOPIC, [REALTIME_LOCK_CLASS, topic.name])
            await transaction.query(PUBLISH_EVENT, [topic.name, idOf(frame), JSON.stringify(frame), NOTIFY_CHANNEL])
        }
        if (within === undefined) await this.writer().transaction(write)
        else await write(within)
    }

    /** The entity manager of the connection that holds the realtime tables. */
    protected writer(): EntityManager {
        return writerOf(this.managers)
    }

    /**
     * The retained frames after the newest frame with id `after`, oldest first. It also notes where the topic stands when the
     * subscription begins: a reload after a lost connection starts from there, so a subscription still waiting for its first frame loses none.
     */
    protected override async replay(topic: string, after: string | undefined): Promise<Replay> {
        const [row] = await this.writer().query<Array<HighestSeqRow>>(SELECT_TOPIC_HIGHEST_SEQ, [topic])
        const position = row?.seq ?? "0"
        if (after === undefined) return { entries: [], position }
        const rows = await this.writer().query<Array<EventRow>>(SELECT_EVENTS_AFTER, [topic, after, REPLAY_FRAMES])
        return { entries: rows.map(entryOf), position }
    }
}
