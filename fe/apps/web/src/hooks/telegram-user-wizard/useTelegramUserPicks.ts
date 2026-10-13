"use client"

import { useCallback, useMemo, useState } from "react"
import { useQueryListTelegramChatsSwr } from "@/hooks/swr"
import { chatKindOf, MAX_CHATS } from "./telegram-user-wizard.shared"
import type { ChatChoice, PickedChat, SinceDays, TelegramInitial } from "./telegram-user-wizard.shared"

/** Fresh chats on every visit; a failure is shown with a retry, not retried by itself. */
const FRESH = { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false } as const

/** The chat list of the account and what the owner ticked, how far back to read, and how often. */
export const useTelegramUserPicks = () => {
    const [chatsFor, setChatsFor] = useState<string | undefined>(undefined)
    const [picked, setPicked] = useState<ReadonlyArray<PickedChat>>([])
    const [sinceDays, setSinceDays] = useState<SinceDays>(7)
    const [every, setEvery] = useState("0")
    const [query, setQuery] = useState("")
    const list = useQueryListTelegramChatsSwr(chatsFor, FRESH)
    const chats = useMemo<ReadonlyArray<ChatChoice>>(
        () =>
            (list.data ?? []).map((chat) => ({
                id: chat.id,
                title: chat.title,
                kind: chatKindOf(chat.kind),
                unread: chat.unread,
            })),
        [list.data],
    )
    const pickedIds = useMemo(() => new Set(picked.map((chat) => chat.id)), [picked])
    // Chats ticked earlier but no longer among the recent ones stay listed so they can be unticked.
    const all = useMemo<ReadonlyArray<ChatChoice>>(
        () => [
            ...chats,
            ...picked
                .filter((chat) => !chats.some((item) => item.id === chat.id))
                .map((chat) => ({ ...chat, unread: 0 })),
        ],
        [chats, picked],
    )
    const needle = query.trim().toLowerCase()
    const visible = needle === "" ? all : all.filter((chat) => chat.title.toLowerCase().includes(needle))

    /** The ticks of the shown chats changed; ticks hidden by the search are kept. */
    const change = (ids: ReadonlyArray<string>) => {
        const visibleIds = new Set(visible.map((chat) => chat.id))
        const kept = picked.filter((chat) => !visibleIds.has(chat.id))
        const added = ids
            .map((id) => all.find((chat) => chat.id === id))
            .filter((chat): chat is ChatChoice => chat !== undefined)
            .map((chat) => ({ id: chat.id, title: chat.title, kind: chat.kind }))
        setPicked([...kept, ...added].slice(0, MAX_CHATS))
    }

    const restore = useCallback((initial: TelegramInitial, resumeId: string | undefined) => {
        setChatsFor(initial.editing ? resumeId : undefined)
        setPicked(initial.picked)
        setSinceDays(initial.sinceDays)
        setEvery(String(initial.everyMinutes ?? 0))
    }, [])

    return {
        loading: chatsFor !== undefined && list.isLoading,
        failed: list.error !== undefined,
        failure: list.error instanceof Error ? list.error.message : null,
        picked,
        pickedIds,
        visible,
        full: picked.length >= MAX_CHATS,
        query,
        sinceDays,
        every,
        change,
        setQuery,
        setSinceDays,
        setEvery,
        restore,
        load: setChatsFor,
        reload: () => {
            void list.mutate()
        },
    }
}
