"use client"

import { useMemo, useState } from "react"
import { useQueryListTelegramChatsSwr } from "@/hooks/swr/api/graphql/queries/useQueryListTelegramChatsSwr"
import { chatKindOf } from "./telegram-user-wizard.shared"
import type { ChatChoice, TelegramInitial } from "./telegram-user-wizard.shared"

/** Fresh chats on every visit; a failure is shown with a retry, not retried by itself. */
const FRESH = { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false } as const

/** The chat list of the account and what the owner ticked, how far back to read, and how often. */
export const useTelegramUserPicks = (initial: TelegramInitial, resumeId: string | undefined) => {
    const [chatsFor, setChatsFor] = useState<string | undefined>(initial.editing ? resumeId : undefined)
    const [picked, setPicked] = useState(initial.picked)
    const [sinceDays, setSinceDays] = useState(initial.sinceDays)
    const [every, setEvery] = useState(String(initial.everyMinutes ?? 0))
    const query = useQueryListTelegramChatsSwr(chatsFor, FRESH)
    const chats = useMemo<ReadonlyArray<ChatChoice>>(
        () =>
            (query.data ?? []).map((chat) => ({
                id: chat.id,
                title: chat.title,
                kind: chatKindOf(chat.kind),
                unread: chat.unread,
            })),
        [query.data],
    )
    return {
        chats,
        loading: chatsFor !== undefined && query.isLoading,
        failed: query.error !== undefined,
        failure: query.error instanceof Error ? query.error.message : null,
        picked,
        sinceDays,
        every,
        setPicked,
        setSinceDays,
        setEvery,
        load: setChatsFor,
        reload: () => {
            void query.mutate()
        },
    }
}
