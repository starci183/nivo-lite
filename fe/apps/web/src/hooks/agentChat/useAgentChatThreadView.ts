"use client"

import { roleOf, conversationRowMapper } from "./agentChat.shared"
import { useCallback, useMemo } from "react"
import type { useFormatter, useTranslations } from "next-intl"
import type { useQueryAgentChatConversationsSwr, useQueryAgentChatMessagesSwr } from "@/hooks/swr"
import type { useAgentChatActions } from "./useAgentChatActions"
import type { ChatTab, Selection } from "./useAgentChat"

/** Formats conversation history and message rows and switches the selected channel. */
export const useAgentChatThreadView = (
    hasCustomerChannel: boolean,
    setTab: import("react").Dispatch<import("react").SetStateAction<ChatTab>>,
    actions: ReturnType<typeof useAgentChatActions>,
    navigate: (kind: ChatTab, id: string | null) => void,
    selected: Selection,
    format: ReturnType<typeof useFormatter>,
    history: ReturnType<typeof useQueryAgentChatConversationsSwr>,
    t: ReturnType<typeof useTranslations<"agentChat">>,
    selectedId: string | null,
    messages: ReturnType<typeof useQueryAgentChatMessagesSwr>,
) => {
    const changeTab = (next: ChatTab) => {
        if (next === "customer" && !hasCustomerChannel) return
        setTab(next)
        actions.message.clearErrors()
        actions.visitor.clearErrors()
        navigate(next, selected[next])
    }

    const timeOf = useCallback(
        (iso: string) =>
            format.dateTime(new Date(iso), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
        [format],
    )

    const rows = useMemo(
        () => (history.data ?? []).map(conversationRowMapper(t, timeOf, selectedId)),
        [history.data, selectedId, t, timeOf],
    )

    const thread = useMemo(
        () =>
            (messages.data ?? []).map((item) => ({
                id: item.id,
                role: roleOf(item.role),
                body: item.body,
                timeLabel: timeOf(item.createdAt),
            })),
        [messages.data, timeOf],
    )
    return { rows, thread, changeTab }
}
