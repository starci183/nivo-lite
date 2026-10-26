"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMember } from "@/hooks/member"
import { useMutateSetChatTypingSwr, useSubscribeChatTypingSwr } from "@/hooks/swr"
import { chatTargetOf, typingSignalOf, withTypingSignal } from "@/modules/office"
import type { TypingSignal } from "@/modules/office"

/** How often a person who keeps typing refreshes the signal: well inside the five seconds the signal lives. */
const REFRESH_MS = 3000

/** When the last "typing" signal of this client went out, and for which room. */
interface LastSent {
    readonly room: string | null
    readonly at: number
}

/**
 * Who else is typing in one Hub room (null = the Office room), over the back end typing event stream, and the
 * command that tells the others this person types. A signal lapses at its own deadline even when the stop never arrives.
 */
export const useOfficeTyping = (room: string | null) => {
    const me = useMember()
    const { trigger } = useMutateSetChatTypingSwr()
    const [signals, setSignals] = useState<ReadonlyArray<TypingSignal>>([])
    const lastSent = useRef<LastSent | null>(null)
    const myId = me?.userId ?? null
    const onPush = useCallback(
        (payload: unknown) => {
            const signal = typingSignalOf(payload)
            if (signal === null || signal.id === myId) return
            setSignals((current) => withTypingSignal(current, signal))
        },
        [myId],
    )
    useSubscribeChatTypingSwr(chatTargetOf(room), onPush)

    useEffect(() => () => setSignals([]), [room, myId])

    useEffect(() => {
        if (signals.length === 0) return undefined
        const next = Math.min(...signals.map((entry) => entry.expiresAt))
        const timer = setTimeout(
            () => setSignals((current) => current.filter((entry) => entry.expiresAt > Date.now())),
            Math.max(0, next - Date.now()) + 50,
        )
        return () => clearTimeout(timer)
    }, [signals])

    /** Called with the draft on every change: refreshes the signal while there is text and stops it when the draft is empty. */
    const onDraft = useCallback(
        (draft: string) => {
            const now = Date.now()
            const previous = lastSent.current
            const isTyping = draft.trim() !== ""
            const isFresh = previous !== null && previous.room === room && now - previous.at < REFRESH_MS
            if (isTyping && !isFresh) {
                lastSent.current = { room, at: now }
                void trigger({ target: chatTargetOf(room), typing: true }, { throwOnError: false })
            } else if (!isTyping && previous !== null) {
                lastSent.current = null
                void trigger({ target: chatTargetOf(room), typing: false }, { throwOnError: false })
            }
        },
        [room, trigger],
    )

    const byRoom: ReadonlyMap<string, ReadonlyArray<TypingSignal>> = useMemo(
        () => new Map([[room ?? "", signals]]),
        [room, signals],
    )
    return { names: signals.map((entry) => entry.name), byRoom, onDraft }
}
