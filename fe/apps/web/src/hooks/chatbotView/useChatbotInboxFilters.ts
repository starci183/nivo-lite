"use client"

import { useState } from "react"
import { useFeatureReset } from "@/hooks/reuseables"
import { matchesInboxFilter, isInboxFilter } from "@/hooks/chatbot"
import type { ChatbotOverview, ChatbotConversation } from "@/modules/types"
import type { InboxFilters } from "./useChatbotInbox"

/** The view `useChatbotInboxFilters` returns. */
export interface ChatbotInboxFiltersView {
    filters: InboxFilters
    visible: ChatbotConversation[]
    setQuery: (value: string) => void
    setFilter: (value: string) => void
}

/** Owns the inbox filter draft and the conversations matching it. */
export const useChatbotInboxFilters = (
    overview: ChatbotOverview | undefined,
    isActive: boolean,
    scope: string,
): ChatbotInboxFiltersView => {
    const [filters, setFilters] = useState<InboxFilters>({ filter: "all", query: "" })
    useFeatureReset({ isActive, isReady: true, scope, onReset: () => setFilters({ filter: "all", query: "" }) })
    const query = filters.query.trim().toLocaleLowerCase()
    const visible =
        overview?.conversations.filter(
            (item) =>
                matchesInboxFilter(item, filters.filter, overview.nowIso) &&
                (query === "" || `${item.name} ${item.lastText}`.toLocaleLowerCase().includes(query)),
        ) ?? []
    const setQuery = (value: string) => setFilters((current) => ({ ...current, query: value }))
    const setFilter = (value: string) =>
        setFilters((current) => ({ ...current, filter: isInboxFilter(value) ? value : current.filter }))
    return { filters, visible, setQuery, setFilter }
}
