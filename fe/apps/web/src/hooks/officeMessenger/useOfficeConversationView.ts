import { useState } from "react"
import type { OfficeConversationRowView, OfficeListView, OfficeText } from "@/modules/types"

type Filter = "all" | "groups" | "unread"
const inFilter = (row: OfficeConversationRowView, filter: Filter): boolean => {
    if (filter === "all") return true
    if (filter === "groups") return row.kind === "group"
    return row.unread > 0
}
type UseOfficeConversationViewResult = {
    view: {
        list: {
            conversations: OfficeConversationRowView[]
            selectedRoom: string
            pendingCount: number
        }
        query: string
        filter: Filter
        filters: {
            id: string
            label: string
        }[]
        copy: {
            searchLabel: string
            searchPlaceholder: string
            clearSearch: string
            filterLabel: string
            listLabel: string
            empty: string
        }
    }
    query: (value: string) => void
    filter: (value: string) => void
}

/** Owns search and filtering while the conversation list is mounted, including the query-dependent empty text. */
export const useOfficeConversationView = (
    list: OfficeListView,
    text: OfficeText,
    mounted: boolean,
): UseOfficeConversationViewResult => {
    const [state, setState] = useState<{ mounted: boolean; query: string; filter: Filter }>({
        mounted,
        query: "",
        filter: "all",
    })
    if (state.mounted !== mounted) setState({ mounted, query: "", filter: "all" })
    const query = state.mounted === mounted ? state.query : ""
    const filter = state.mounted === mounted ? state.filter : "all"
    const q = query.trim()
    return {
        view: {
            list: {
                ...list,
                conversations: list.conversations.filter(
                    (row) => inFilter(row, filter) && (q === "" || row.label.toLowerCase().includes(q.toLowerCase())),
                ),
            },
            query,
            filter,
            filters: [
                { id: "all", label: text("filterAll") },
                { id: "groups", label: text("filterGroups") },
                { id: "unread", label: text("filterUnread") },
            ],
            copy: {
                searchLabel: text("searchLabel"),
                searchPlaceholder: text("searchPlaceholder"),
                clearSearch: text("clearSearch"),
                filterLabel: text("filterLabel"),
                listLabel: text("listLabel"),
                empty: q !== "" ? text("noMatches", { q }) : text(filter === "unread" ? "emptyUnread" : "emptyList"),
            },
        },
        query: (value: string): void => setState((current) => ({ ...current, query: value })),
        filter: (value: string): void => {
            if (value === "all" || value === "groups" || value === "unread")
                setState((current) => ({ ...current, filter: value }))
        },
    }
}
