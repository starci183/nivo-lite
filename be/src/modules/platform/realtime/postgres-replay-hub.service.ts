import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { advisoryXactLock, notify, returnedRows, rowShape } from "@modules/platform/database"
import { writerOf } from "./realtime-connection.policy"
import { RealtimeSubscriptionsPolicy } from "./realtime-subscriptions.policy"
import type { Entry, Replay } from "./realtime-subscriptions.policy"
import { NOTIFY_CHANNEL, REALTIME_LOCK_NAMESPACE, REPLAY_FRAMES } from "./realtime.contracts"
import { InjectRealtimeManagers } from "./realtime.decorators"
import type { RealtimeTopic, RealtimeTransaction } from "./realtime.port"
import { SubscribedRealtimeHub } from "./subscribed-realtime-hub.service"
import { RealtimeEventEntity } from "./persistence/entities"

/** The columns of a retained frame a delivery needs. */
export type EventFacts = Pick<RealtimeEventEntity, "seq" | "topic" | "payload">

/** The entry a loaded row stands for. */
export const entryOf = (row: EventFacts): Entry => ({ position: row.seq, topic: row.topic, frame: row.payload })

/** The row an insert of a retained frame returns: its sequence number, which the driver returns as text. */
const isSeqRow = rowShape({ seq: "string" })

/** Orders table sequence numbers, which the driver returns as text. */
const comparePositions = (left: string, right: string): number => Number(left) - Number(right)

/** The string `id` a frame carries, or null: only a frame with an id can be resumed after. */
const idOf = (frame: object): string | null => {
    const id: unknown = Reflect.get(frame, "id")
    return typeof id === "string" ? id : null
}

@Injectable()
/**
 * The write and replay half of the Postgres hub: `publish` writes the frame to `realtime_events` and NOTIFYs in one transaction under a
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
            await advisoryXactLock(transaction, `${REALTIME_LOCK_NAMESPACE}${topic.name}`)
            const written = await transaction
                .createQueryBuilder(RealtimeEventEntity, "e")
                .insert()
                .values({ topic: topic.name, eventId: idOf(frame), payload: frame })
                .returning("seq")
                .execute()
            const seq = Number(returnedRows(written.raw, isSeqRow)[0]?.seq)
            await notify(transaction, NOTIFY_CHANNEL, JSON.stringify({ topic: topic.name, seq }))
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
        const row = await this.writer()
            .createQueryBuilder(RealtimeEventEntity, "e")
            .select("COALESCE(max(e.seq), 0)", "seq")
            .where("e.topic = :topic", { topic })
            .getRawOne<{ seq: string }>()
        const position = row?.seq ?? "0"
        if (after === undefined) return { entries: [], position }
        // The newest frames after the frame with the given id (all of the topic's newest when the table no longer holds the id), oldest first.
        const rows = await this.writer()
            .createQueryBuilder(RealtimeEventEntity, "newest")
            .select(["newest.seq AS seq", "newest.topic AS topic", "newest.payload AS payload"])
            .innerJoin(
                (latest) =>
                    latest
                        .select("e.seq", "seq")
                        .from(RealtimeEventEntity, "e")
                        .where(
                            "e.topic = :topic AND e.seq > COALESCE((SELECT max(x.seq) FROM public.realtime_events x WHERE x.topic = :topic AND x.event_id = :afterId), 0)",
                        )
                        .orderBy("e.seq", "DESC")
                        .limit(REPLAY_FRAMES),
                "latest",
                "latest.seq = newest.seq",
            )
            .setParameters({ topic, afterId: after })
            .orderBy("newest.seq", "ASC")
            .limit(REPLAY_FRAMES)
            .getRawMany<EventFacts>()
        return { entries: rows.map(entryOf), position }
    }
}
