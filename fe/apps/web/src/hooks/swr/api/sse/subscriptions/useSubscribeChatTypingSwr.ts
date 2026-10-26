import { useEffect, useRef } from "react"
import { useSWRConfig } from "swr"
import useSWRSubscription from "swr/subscription"
import { QUERY_CHAT_MARKER_STATE_SWR_KEY } from "../../graphql/queries/useQueryChatMarkerStateSwr"
import { useViewerKeyId, useWorkspaceKey } from "@/hooks/workspaceKey"
import { streamChatTyping } from "@/modules/api/sse/office/stream-chat-typing"
import type { ChatTypingPush, ChatTypingTarget } from "@/modules/api/sse/office/stream-chat-typing"

/** The signal payload of one pushed frame, as `typingSignalOf` reads it: the sender, whether they type, and the deadline. */
export interface ChatTypingSignalPayload {
    readonly id: string
    readonly name: string
    readonly typing: boolean
    readonly expiresAt: string
}

/** How long a start frame keeps a person listed when no stop arrives: the five-second deadline of the signal. */
const SIGNAL_TTL_MS = 5000

/** The payload of one frame; the deadline never lies beyond five seconds from now, so a clock skew cannot pin a name. */
const payloadOf = (push: ChatTypingPush): ChatTypingSignalPayload => {
    const at = Date.parse(push.at)
    const now = Date.now()
    const until = Math.min(Number.isNaN(at) ? now : at, now) + SIGNAL_TTL_MS
    return {
        id: push.actorId,
        name: push.actorName,
        typing: push.state === "start",
        expiresAt: new Date(until).toISOString(),
    }
}

/** The SWR key of the chat-typing stream; the full key carries the workspace, the signed-in reader and the target. */
export const SUBSCRIBE_CHAT_TYPING_SWR_KEY = "SUBSCRIBE_CHAT_TYPING_SWR"

/** The key of one target's typing stream; null while nobody is signed in or no workspace is active. */
type ChatTypingStreamKey = readonly [string, string, string | null, string] | null

/**
 * The typing frames the back end pushes for one chat target (a Hub room, or the Office room by none). The stream opens with the
 * first reader of the key and closes with the last; each frame is the hook's data and is also handed to `onSignal` as the payload `typingSignalOf` reads, so two frames in
 * one tick are both seen; each (re)open revalidates the chat marker state, which closes the gap since the last frame. A refused or broken attempt is the hook's error until the next frame.
 */
export const useSubscribeChatTypingSwr = (
    target: ChatTypingTarget,
    onSignal: (payload: ChatTypingSignalPayload) => void,
) => {
    const userId = useViewerKeyId()
    const key = useWorkspaceKey(
        SUBSCRIBE_CHAT_TYPING_SWR_KEY,
        [userId ?? null, target.room ?? ""] as const,
        userId !== undefined,
    )
    const { mutate } = useSWRConfig()
    const latest = useRef(onSignal)
    useEffect(() => {
        latest.current = onSignal
    }, [onSignal])
    return useSWRSubscription<ChatTypingPush, Error, ChatTypingStreamKey>(key, ([, , , room], { next }) => {
        const controller = new AbortController()
        void streamChatTyping({
            target: room === "" ? {} : { room },
            signal: controller.signal,
            onOpen: () =>
                void mutate(
                    (cached: unknown) => Array.isArray(cached) && cached[0] === QUERY_CHAT_MARKER_STATE_SWR_KEY,
                ),
            onPush: (push) => {
                next(null, push)
                latest.current(payloadOf(push))
            },
            report: (line) => next(new Error(line)),
        })
        return () => controller.abort()
    })
}
