import { Injectable } from "@nestjs/common"
import type { MessageEvent } from "@nestjs/common"
import type { Observable } from "rxjs"
import { eventStream } from "./event-stream.mapper"
import { RealtimeSubscriptionsPolicy } from "./realtime-subscriptions.policy"
import type { Replay } from "./realtime-subscriptions.policy"
import type { EventFrame, RealtimeHub, RealtimeSubscribeOptions, RealtimeTopic } from "./realtime.port"

/** The string `id` a frame carries, or undefined: only a frame with an id can be resumed after. */
const idOf = (frame: object): string | undefined => {
    const id: unknown = Reflect.get(frame, "id")
    return typeof id === "string" ? id : undefined
}

@Injectable()
/**
 * What every hub shares: the subscriptions of this replica, the stream a client reads and the replay it starts with. On its own it
 * is the local hub (a frame reaches the subscriptions of this process and nothing is retained); an adapter overrides `publish` to
 * reach the other replicas and `replay` to read the frames a reconnecting client missed from its store. The reading side is the same
 * for the memory hub and the shared hubs, so a door never changes between them.
 */
export class SubscribedRealtimeHub implements RealtimeHub {
    /** Shared hubs replace this with a policy that carries their store ordering and initial floor; local hubs have no ordered replay positions. */
    protected readonly subscriptions: RealtimeSubscriptionsPolicy = new RealtimeSubscriptionsPolicy()

    /** Pushes the frame to every subscription of the topic open in this process. */
    publish<T extends object>(topic: RealtimeTopic<T>, frame: T): Promise<void> {
        this.subscriptions.fanOut([{ topic: topic.name, frame, position: idOf(frame) ?? "" }])
        return Promise.resolve()
    }

    /** The frames published to the topic (after the `after` frame, when given) while the reader keeps reading the stream. */
    subscribe<T extends object>(topic: RealtimeTopic<T>, options?: RealtimeSubscribeOptions): AsyncIterable<T> {
        return {
            [Symbol.asyncIterator]: () => this.subscriptions.join(topic, this.replay(topic.name, options?.after)),
        }
    }

    /** The subscription of the topic as server-sent events (see `eventStream`). */
    stream<T extends EventFrame>(
        topic: RealtimeTopic<T>,
        options?: RealtimeSubscribeOptions,
    ): Observable<MessageEvent> {
        return eventStream(this.subscribe(topic, options))
    }

    /** How many subscriptions of the topic are open on this replica now. */
    subscriberCount(topic: RealtimeTopic<object>): number {
        return this.subscriptions.count(topic.name)
    }

    /** The retained frames of the topic published after the frame with id `after`, oldest first; this hub retains none. */
    protected replay(_topic: string, _after: string | undefined): Promise<Replay> {
        return Promise.resolve({ entries: [] })
    }
}
