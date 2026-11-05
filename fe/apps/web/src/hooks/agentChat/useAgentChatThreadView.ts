"use client"

import { roleOf, conversationRowMapper } from "./agentChat.shared"
import { daysAgoOf } from "@/modules/agent-chat"
import type { ChatThreadMessage } from "@/modules/agent-chat"
import { useCallback, useMemo } from "react"
import type { useFormatter, useTranslations } from "next-intl"
import type { useQueryAgentChatConversationsSwr, useQueryAgentChatMessagesSwr } from "@/hooks/swr"
import type { useAgentChatActions } from "./useAgentChatActions"
import type { ChatTab, Selection } from "./useAgentChat"

/** The resolved inputs for agent chat thread input. */
interface AgentChatThreadInput {
    readonly hasCustomerChannel: boolean
    readonly setTab: import("react").Dispatch<import("react").SetStateAction<ChatTab>>
    readonly actions: ReturnType<typeof useAgentChatActions>
    readonly navigate: (kind: ChatTab, id: string | null) => void
    readonly selected: Selection
    readonly format: ReturnType<typeof useFormatter>
    readonly history: ReturnType<typeof useQueryAgentChatConversationsSwr>
    readonly t: ReturnType<typeof useTranslations<"agentChat">>
    readonly selectedId: string | null
    readonly messages: ReturnType<typeof useQueryAgentChatMessagesSwr>
}

/** The view `useAgentChatThreadView` returns. */
export interface AgentChatThreadView {
    rows: {
        id: string
        kind: ChatTab
        title: string
        description: string
        isSelected: boolean
    }[]
    thread: ChatThreadMessage[]
    changeTab: (next: ChatTab) => void
    isLoadingList: boolean
    isLoadingThread: boolean
}

/** Formats conversation history and message rows and switches the selected channel. */
export const useAgentChatThreadView = ({
    hasCustomerChannel,
    setTab,
    actions,
    navigate,
    selected,
    format,
    history,
    t,
    selectedId,
    messages,
}: AgentChatThreadInput): AgentChatThreadView => {
    const changeTab = (next: ChatTab) => {
        if (next === "customer" && !hasCustomerChannel) return
        setTab(next)
        actions.message.clearErrors()
        actions.visitor.clearErrors()
        navigate(next, selected[next])
    }

    /** The time of day of a message, and when a row was started: the time today, "yesterday", else the date. */
    const hourOf = useCallback(
        (iso: string) => format.dateTime(new Date(iso), { hour: "2-digit", minute: "2-digit", hour12: false }),
        [format],
    )
    const whenOf = useCallback(
        (iso: string) => {
            const daysAgo = daysAgoOf(iso, new Date())
            if (daysAgo <= 0) return hourOf(iso)
            if (daysAgo === 1) return t("whenYesterday")
            return format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit" })
        },
        [format, hourOf, t],
    )
    const dayOf = useCallback(
        (iso: string) => {
            const daysAgo = daysAgoOf(iso, new Date())
            if (daysAgo <= 0) return t("dayToday")
            if (daysAgo === 1) return t("dayYesterday")
            return format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit", year: "numeric" })
        },
        [format, t],
    )

    const rows = useMemo(
        () => (history.data ?? []).map(conversationRowMapper(t, whenOf, selectedId)),
        [history.data, selectedId, t, whenOf],
    )

    const thread = useMemo(
        () =>
            (messages.data ?? []).map((item, index, all): ChatThreadMessage => {
                const day = dayOf(item.createdAt)
                const previous = all[index - 1]
                return {
                    id: item.id,
                    role: roleOf(item.role),
                    body: item.body,
                    timeLabel: hourOf(item.createdAt),
                    dayLabel: previous !== undefined && dayOf(previous.createdAt) === day ? null : day,
                    files: item.files,
                }
            }),
        [messages.data, dayOf, hourOf],
    )
    return { rows, thread, changeTab, isLoadingList: history.isLoading, isLoadingThread: messages.isLoading }
}
