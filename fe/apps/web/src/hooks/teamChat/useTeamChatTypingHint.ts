"use client"

import { useCallback, useRef } from "react"
import { useMutateSetChatTypingSwr } from "@/hooks/swr"

/** How long a typing hint holds on the receivers' side, so the next one is due a little before it (milliseconds). */
const HINT_REFRESH_MS = 4_000

/**
 * Tells the other members of a room that the viewer is typing: a draft that grows sends one hint now and another every few seconds
 * while the typing goes on, and a draft that empties or is sent sends the stop. A failed hint is dropped (it is only a hint).
 */
export const useTeamChatTypingHint = (workspaceId: string, roomId: string | null): ((isTyping: boolean) => void) => {
    const { trigger } = useMutateSetChatTypingSwr(workspaceId)
    const lastSentAt = useRef<number | null>(null)
    /** Whether the last hint was lost: a hint is only a hint, so it is noted and the next one is tried. */
    const failed = useRef(false)
    return useCallback(
        (isTyping: boolean): void => {
            if (roomId === null) return
            const moment = performance.now()
            if (isTyping) {
                if (lastSentAt.current !== null && moment - lastSentAt.current < HINT_REFRESH_MS) return
                lastSentAt.current = moment
            } else {
                if (lastSentAt.current === null) return
                lastSentAt.current = null
            }
            void trigger({ roomId, typing: isTyping }).then(
                () => {
                    failed.current = false
                },
                () => {
                    failed.current = true
                },
            )
        },
        [roomId, trigger],
    )
}
