import type { MessageEvent } from "@nestjs/common"
import type { Observable } from "rxjs"
import type { PrivateBroadcast } from "./realtime.contracts"

/** The private broadcast capability; domains authorize targets and author payloads before publishing. */
export interface RealtimePublisher {
    /** Broadcasts one server-authored payload on a private channel. */
    publishPrivate(message: PrivateBroadcast): Promise<void>
}

/** A named channel of frames of one type: built by the owning domain contract, shared by the publisher and the door. */
export interface RealtimeTopic<T extends object> {
    /** The channel name, unique per owner and scope. */
    readonly name: string
    /** True when a value is a frame of this topic. */
    accepts(frame: unknown): frame is T
}

/** What a client may ask of a subscription when it reconnects. */
export interface RealtimeSubscribeOptions {
    /** The `id` of the last frame the client received (`Last-Event-ID`). */
    readonly after?: string | undefined
}

/** A frame the SSE door can carry: its `id` is the resume point. */
export interface EventFrame {
    /** The domain event id of the frame, unique within its topic. */
    readonly id: string
}

/** The push hub of the realtime kind (minimal port; the hub lane's version wins at merge). */
export interface RealtimeHub {
    /** Pushes one frame to the topic. */
    publish<T extends object>(topic: RealtimeTopic<T>, frame: T): Promise<void>
    /** The same frames as server-sent events; unsubscribing releases the subscription. */
    stream<T extends EventFrame>(topic: RealtimeTopic<T>, options?: RealtimeSubscribeOptions): Observable<MessageEvent>
}
