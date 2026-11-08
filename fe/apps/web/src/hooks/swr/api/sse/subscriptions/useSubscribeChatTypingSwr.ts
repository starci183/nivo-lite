"use client"

import { useSWRConfig } from "swr"
import useSWRSubscription from "swr/subscription"
import { useViewerKeyId, useWorkspaceKey } from "@/hooks/workspaceKey"
import { matchesSwrKey } from "@/modules/utils"
import { QUERY_CHAT_UNREAD_SWR_KEY } from "../../graphql/queries/useQueryChatUnreadSwr"
import { streamChatTyping } from "@/modules/api/sse/chat/stream-chat-typing"
import type { ChatTypingPush } from "@/modules/api/sse/chat/stream-chat-typing"
import type { SWRSubscriptionResponse } from "swr/subscription"

/** The SWR key of the typing stream of one room; the full key carries the workspace, the signed-in member and the room. */
export const SUBSCRIBE_CHAT_TYPING_SWR_KEY = "SUBSCRIBE_CHAT_TYPING_SWR"

/** The key of the stream; null while nobody is signed in, no workspace is active or no room is open. */
type ChatTypingStreamKey = readonly [string, string, ...Array<string | null>] | null

/** What the subscription holds: the newest hint of each person who typed in the room, by person. */
export type ChatTypingHints = Readonly<Record<string, ChatTypingPush>>

const NO_HINTS: ChatTypingHints = {}

/** The hints with this one kept: a stop clears the person, a start replaces what was held. */
const withHint = (hints: ChatTypingHints, push: ChatTypingPush): ChatTypingHints => {
    if (!push.typing) return Object.fromEntries(Object.entries(hints).filter(([id]) => id !== push.id))
    return { ...hints, [push.id]: push }
}

/**
 * The typing hints of one room, pushed by the typing stream. A hint holds only until its own `expiresAt`, which the owner enforces
 * against its clock, so a lost stop never leaves a name on screen. A dropped stream clears the hints. No room, no stream.
 */
export const useSubscribeChatTypingSwr = (roomId: string | null): SWRSubscriptionResponse<ChatTypingHints, Error> => {
    const viewerId = useViewerKeyId()
    const { mutate } = useSWRConfig()
    const key = useWorkspaceKey(
        SUBSCRIBE_CHAT_TYPING_SWR_KEY,
        [viewerId ?? null, roomId],
        roomId !== null && viewerId !== undefined && viewerId !== "signed-out",
    )
    return useSWRSubscription<ChatTypingHints, Error, ChatTypingStreamKey>(key, ([, , , room], { next }) => {
        const controller = new AbortController()
        if (room !== null && room !== undefined)
            streamChatTyping({
                roomId: room,
                signal: controller.signal,
                onOpen: () => void mutate(matchesSwrKey(QUERY_CHAT_UNREAD_SWR_KEY)),
                onPush: (push) => next(null, (hints) => withHint(hints ?? NO_HINTS, push)),
                onDrop: () => next(null, () => NO_HINTS),
            })
        return () => controller.abort()
    })
}
