import type { MessageEvent } from "@nestjs/common"
import type { Observable } from "rxjs"

/** A named channel of frames of one type: the one object a publisher pushes to and a door subscribes to, built by the owning domain contract. */
export interface RealtimeTopic<T extends object> {
    /** The channel name, unique per owner and scope (for example `booking-status:<owner>`). */
    readonly name: string
    /** True when a value is a frame of this topic; a value that is not one is never delivered. */
    accepts(frame: unknown): frame is T
}

/**
 * The transaction a publisher is inside of. A hub that keeps its frames in the same database writes the frame in it, so the frame is
 * committed and announced together with the publisher's own write, and a rolled-back write publishes nothing. Any entity manager satisfies it.
 */
export interface RealtimeTransaction {
    /** Runs one statement in the transaction. */
    query(text: string, parameters?: Array<unknown>): Promise<unknown>
}

/** What a client may ask of a subscription when it reconnects. */
export interface RealtimeSubscribeOptions {
    /**
     * The `id` of the last frame the client received (the `Last-Event-ID` of an SSE reconnect). The stream starts with the frames the
     * hub still retains after it; an id the hub no longer retains starts with every retained frame, so the client converges and
     * refetches a snapshot for anything older. Absent: live frames only.
     */
    readonly after?: string | undefined
}

/**
 * The push hub of the realtime kind: a publisher pushes a frame to a topic, a realtime door subscribes a client to a topic. One port,
 * three adapters (memory, Postgres, Redis): the doors never change between a single replica and N replicas, only the hub binding does.
 */
export interface RealtimeHub {
    /**
     * Pushes one frame to every subscription of the topic open now, on every replica of the api, and retains it (bounded) when it
     * carries a string `id`. It settles once the hub has accepted the frame: a shared hub has written it durably before it resolves.
     * Given the publisher's transaction, the Postgres hub writes the frame inside it (the push goes out at commit); the other hubs push at once.
     */
    publish<T extends object>(topic: RealtimeTopic<T>, frame: T, within?: RealtimeTransaction): Promise<void>
    /** The frames pushed to the topic (after the `after` frame, when given) until the client stops reading the returned stream. */
    subscribe<T extends object>(topic: RealtimeTopic<T>, options?: RealtimeSubscribeOptions): AsyncIterable<T>
    /**
     * The same frames as server-sent events, for an SSE door: the opening frame, one event per frame with its `id`, and a comment
     * heartbeat while the channel is idle. Unsubscribing, which is what a disconnected client does, releases the subscription.
     */
    stream<T extends EventFrame>(topic: RealtimeTopic<T>, options?: RealtimeSubscribeOptions): Observable<MessageEvent>
    /** How many subscriptions of the topic are open on this replica now. */
    subscriberCount(topic: RealtimeTopic<object>): number
}

/** A frame the SSE door can carry: its `id` is the domain event id, the resume point a reconnecting client names in `Last-Event-ID`. */
export interface EventFrame {
    /** The domain event id of the frame, unique within its topic. */
    readonly id: string
}
