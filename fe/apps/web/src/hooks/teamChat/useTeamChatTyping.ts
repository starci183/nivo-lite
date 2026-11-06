"use client"

import { useNow } from "next-intl"
import useSWRSubscription from "swr/subscription"
import { useViewerKeyId, useWorkspaceKey } from "@/hooks/workspaceKey"
import { streamChatTyping } from "@/modules/api/sse/chat/stream-chat-typing"
import type { ChatTypingPush } from "@/modules/api/sse/chat/stream-chat-typing"

/** The SWR key of the typing stream of one room; the full key carries the workspace, the signed-in member and the room. */
const SUBSCRIBE_CHAT_TYPING_SWR_KEY = "SUBSCRIBE_CHAT_TYPING_SWR"

/** The key of the stream; null while nobody is signed in, no workspace is active or no room is open. */
type ChatTypingStreamKey = readonly [string, string, ...Array<string | null>] | null

/** What the subscription holds: the newest hint of each person who typed in the room. */
type TypingHints = Readonly<Record<string, ChatTypingPush>>

/** How often a hint is checked for having lapsed (milliseconds). */
const LAPSE_CHECK_MS = 1_000

const NO_HINTS: TypingHints = {}

/** The hints with this one kept: a stop clears the person, a start replaces what was held. */
const withHint = (hints: TypingHints, push: ChatTypingPush): TypingHints => {
    if (!push.typing) return Object.fromEntries(Object.entries(hints).filter(([id]) => id !== push.id))
    return { ...hints, [push.id]: push }
}

/**
 * The names of the people typing in one room right now, pushed by the typing stream; a hint holds only until its own deadline, so a
 * lost stop never leaves a name on screen. No room, no stream.
 */
export const useTeamChatTyping = (roomId: string | null): ReadonlyArray<string> => {
    const viewerId = useViewerKeyId()
    const now = useNow({ updateInterval: LAPSE_CHECK_MS })
    const key = useWorkspaceKey(
        SUBSCRIBE_CHAT_TYPING_SWR_KEY,
        [viewerId ?? null, roomId],
        roomId !== null && viewerId !== undefined && viewerId !== "signed-out",
    )
    const subscription = useSWRSubscription<TypingHints, Error, ChatTypingStreamKey>(
        key,
        ([, , , room], { next }) => {
            const controller = new AbortController()
            if (room === null || room === undefined) return () => controller.abort()
            void streamChatTyping({
                roomId: room,
                signal: controller.signal,
                onPush: (push) => next(null, (hints) => withHint(hints ?? NO_HINTS, push)),
                onDrop: () => next(null, () => NO_HINTS),
            })
            return () => controller.abort()
        },
    )
    return Object.values(subscription.data ?? NO_HINTS)
        .filter((hint) => new Date(hint.expiresAt).getTime() > now.getTime())
        .map((hint) => hint.name)
}
