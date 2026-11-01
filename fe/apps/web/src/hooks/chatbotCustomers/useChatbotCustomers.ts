"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { slotOfSwr } from "@/hooks/slot"
import { agentHref } from "@/modules/installations"
import {
    CUSTOMERS_FETCHED,
    CUSTOMER_FILTERS,
    customerFilterLabelOf,
    customerRowsOf,
    isCustomerFilter,
} from "./chatbotCustomers.shared"
import type { CustomerFilter } from "./chatbotCustomers.shared"
import { useChatbotWorkbench } from "@/hooks/chatbotWorkbench"

/** The Customers tab of one Chatbot instance: the customers behind its conversations, narrowed by a chip and a search. */
export const useChatbotCustomers = (installationId: string | null) => {
    const t = useTranslations("workbenchChatbot")
    const workbench = useChatbotWorkbench(installationId, null)
    const [filter, setFilter] = useState<CustomerFilter>("all")
    const [query, setQuery] = useState("")
    const overview = workbench.overview
    const hrefOf = (conversationId: string): string =>
        agentHref(
            "chatbot",
            installationId,
            "workbench",
            new URLSearchParams({ tab: "customers", focus: conversationId }).toString(),
        )
    const rows =
        overview === undefined
            ? undefined
            : customerRowsOf(t, overview.conversations, filter, query, overview.nowIso, hrefOf)
    const isFull = (overview?.conversations.length ?? 0) >= CUSTOMERS_FETCHED
    return {
        slot: slotOfSwr({
            data: rows,
            error: workbench.isFailed ? t("loadError") : undefined,
            isLoading: overview === undefined && !workbench.isFailed,
        }),
        filter,
        query,
        isFull,
        full: t("customersFull", { n: CUSTOMERS_FETCHED }),
        chips: CUSTOMER_FILTERS.map((id) => ({ id, label: customerFilterLabelOf(t, id) })),
        setFilter: (id: string) => {
            if (isCustomerFilter(id)) setFilter(id)
        },
        setQuery,
        reload: workbench.reload,
    }
}
