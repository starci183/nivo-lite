import type { PrivateBroadcast } from "./realtime.contracts"

/** The private broadcast capability; domains authorize targets and author payloads before publishing. */
export interface RealtimePublisher {
    /** Broadcasts one server-authored payload on a private channel. */
    publishPrivate(message: PrivateBroadcast): Promise<void>
}
