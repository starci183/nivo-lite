import { Injectable } from "@nestjs/common"
import { readStreamEntry } from "./redis-envelope.mapper"
import type { StreamEntry } from "./redis-envelope.mapper"
import type { Replay } from "./realtime-subscriptions.policy"
import { RealtimeSubscriptionsPolicy } from "./realtime-subscriptions.policy"
import { REPLAY_FRAMES, REPLAY_TTL_MS, RETAIN_AND_PUBLISH_SCRIPT } from "./realtime.contracts"
import { InjectRedisPublisher, InjectRedisRealtimeOptions } from "./realtime.decorators"
import type { RedisRealtimeOptions } from "./realtime.options"
import type { RealtimeTopic } from "./realtime.port"
import type { RedisConnection, RedisStreamReply } from "./redis-realtime.port"
import { compareStreamIds } from "./redis-stream-id.policy"
import { SubscribedRealtimeHub } from "./subscribed-realtime-hub.service"

const defined = (entry: StreamEntry | undefined): entry is StreamEntry => entry !== undefined

/** The retained entries of a stream reply that the hub wrote. */
export const retainedOf = (topic: string, reply: RedisStreamReply): Array<StreamEntry> =>
    reply.map((raw) => readStreamEntry(topic, raw)).filter(defined)

/** The string `id` a frame carries, or null: only a frame with an id can be resumed after. */
const idOf = (frame: object): string | null => {
    const id: unknown = Reflect.get(frame, "id")
    return typeof id === "string" ? id : null
}

@Injectable()
/**
 * The write and replay half of the Redis hub: `publish` runs one atomic script that appends a frame that carries an id to the Redis
 * Stream of its topic (`XADD MAXLEN ~`, with a time to live) and publishes it, with its stream id, on one Pub/Sub channel; a reconnect of
 * a client on any replica reads the stream and resumes after its `Last-Event-ID` (the newest match).
 */
export class RedisReplayHubService extends SubscribedRealtimeHub {
    protected override readonly subscriptions = new RealtimeSubscriptionsPolicy(compareStreamIds, "0-0")

    constructor(
        @InjectRedisPublisher() protected readonly publisher: RedisConnection,
        @InjectRedisRealtimeOptions() protected readonly options: RedisRealtimeOptions,
    ) {
        super()
    }

    /** Retains the frame when it carries an id, and publishes it to every replica, in one atomic step. */
    override async publish<T extends object>(topic: RealtimeTopic<T>, frame: T): Promise<void> {
        const id = idOf(frame)
        const json = JSON.stringify(frame)
        if (id === null) {
            await this.publisher.publish(
                this.options.prefix,
                JSON.stringify({ topic: topic.name, position: "", frame: json }),
            )
            return
        }
        await this.publisher.eval(
            RETAIN_AND_PUBLISH_SCRIPT,
            1,
            this.keyOf(topic.name),
            REPLAY_FRAMES,
            id,
            json,
            REPLAY_TTL_MS,
            this.options.prefix,
            topic.name,
        )
    }

    protected keyOf(topic: string): string {
        return `${this.options.prefix}:${topic}`
    }

    /**
     * The retained frames after the newest frame with id `after`, oldest first and at most the retained length; an id the stream no
     * longer holds replays the newest retained frames. It also notes where the stream stands, for the reload after a reconnect.
     */
    protected override async replay(topic: string, after: string | undefined): Promise<Replay> {
        const reply = await this.publisher.xrange(this.keyOf(topic), "-", "+")
        const position = reply.at(-1)?.[0] ?? "0-0"
        if (after === undefined) return { entries: [], position }
        const retained = retainedOf(topic, reply)
        const index = retained.map((entry) => entry.id).lastIndexOf(after)
        return {
            entries: retained
                .slice(index + 1)
                .slice(-REPLAY_FRAMES)
                .map((entry) => entry.entry),
            position,
        }
    }
}
