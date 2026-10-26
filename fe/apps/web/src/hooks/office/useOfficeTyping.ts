"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useMember } from "@/hooks/member"
import { useMutateSetChatTypingSwr, useQueryChatTypingChannelSwr } from "@/hooks/swr"
import { joinPrivateBroadcast } from "@/modules/auth"
import { chatTargetOf, typingSignalOf, withTypingSignal } from "@/modules/office"
import type { TypingSignal } from "@/modules/office"

/** How often a person who keeps typing refreshes the signal: well inside the five seconds the signal lives. */
const REFRESH_MS = 3000

/** When the last "typing" signal of this client went out, and for which room. */
interface LastSent {
    readonly room: string | null
    readonly at: number
}

type SignalMap = ReadonlyMap<string, ReadonlyArray<TypingSignal>>

/** The map with one more signal recorded for a room. */
const withSignalIn = (current: SignalMap, key: string, signal: Parameters<typeof withTypingSignal>[1]): SignalMap =>
    new Map(current).set(key, withTypingSignal(current.get(key) ?? [], signal))

/** The map without the signals whose deadline has passed. */
const withoutLapsed = (current: SignalMap): SignalMap =>
    new Map([...current].map(([key, entries]) => [key, entries.filter((entry) => entry.expiresAt > Date.now())]))

/**
 * Who else is typing in each listed Hub room, over its authorized private broadcast channel, and the command that tells the
 * others this person types in the open room. A signal lapses at its own deadline even when the stop never arrives.
 */
export const useOfficeTyping = (room: string | null, keys: ReadonlyArray<string | null>) => {
    const me = useMember()
    const channels = useQueryChatTypingChannelSwr(keys.map(chatTargetOf))
    const { trigger } = useMutateSetChatTypingSwr()
    const [signals, setSignals] = useState<SignalMap>(new Map())
    const lastSent = useRef<LastSent | null>(null)
    const myId = me?.userId ?? null
    const answers = channels.data

    useEffect(() => {
        if (answers === undefined) return undefined
        const leaves = answers.flatMap(({ request, channel }) => {
            if (channel?.private !== true) return []
            const key = request.room ?? ""
            return [
                joinPrivateBroadcast(channel.topic, channel.event, (payload) => {
                    const signal = typingSignalOf(payload)
                    if (signal === null || signal.id === myId) return
                    setSignals((current) => withSignalIn(current, key, signal))
                }),
            ]
        })
        return () => {
            leaves.forEach((leave) => leave())
            setSignals(new Map())
        }
    }, [answers, myId])

    useEffect(() => {
        const active = [...signals.values()].flat()
        if (active.length === 0) return undefined
        const next = Math.min(...active.map((entry) => entry.expiresAt))
        const timer = setTimeout(() => setSignals(withoutLapsed), Math.max(0, next - Date.now()) + 50)
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
                void trigger({ target: chatTargetOf(previous.room), typing: false }, { throwOnError: false })
            }
        },
        [room, trigger],
    )

    return { names: (signals.get(room ?? "") ?? []).map((entry) => entry.name), byRoom: signals, onDraft }
}
