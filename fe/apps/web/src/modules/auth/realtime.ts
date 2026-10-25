import type { RealtimeChannel } from "@supabase/supabase-js"
import { authClient } from "./client"

/** Receives the payload of each broadcast message of the joined topic. */
type BroadcastPayloadHandler = (payload: unknown) => void

/** Whether the join was abandoned and the channel it opened, once it opened. */
interface JoinState {
    isLeft: boolean
    channel: RealtimeChannel | null
}

/** What a broadcast message carries; only its payload is read. */
interface BroadcastMessage {
    readonly payload?: unknown
}

/**
 * Joins one private Realtime broadcast topic with the signed-in person's token and hands each payload to `onPayload`. It returns
 * the function that leaves the topic, which is safe to call before the join has finished.
 */
export const joinPrivateBroadcast = (
    topic: string,
    event: string,
    onPayload: BroadcastPayloadHandler,
): (() => void) => {
    const client = authClient()
    const state: JoinState = { isLeft: false, channel: null }
    const join = async (): Promise<void> => {
        const { data } = await client.auth.getSession()
        if (data.session !== null) await client.realtime.setAuth(data.session.access_token)
        if (state.isLeft) return
        state.channel = client.channel(topic, { config: { private: true } })
        state.channel.on("broadcast", { event }, (message: BroadcastMessage) => onPayload(message.payload)).subscribe()
    }
    void join()
    return () => {
        state.isLeft = true
        if (state.channel !== null) void client.removeChannel(state.channel)
    }
}
