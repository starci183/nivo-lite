"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useFeatureReset } from "@/hooks/reuseables"
import { slotOfReads } from "@/hooks/slot"
import { agentHref } from "@/modules/installations"
import {
    CUSTOMERS_FETCHED,
    CUSTOMER_FILTERS,
    customerFilterLabelOf,
    customerRowsOf,
    isCustomerFilter,
} from "./chatbotCustomers.shared"
import type { CustomerFilter } from "./chatbotCustomers.shared"
import { useChatbotWorkbench } from "@/hooks/chatbot"

/** The Customers tab of one Chatbot instance: the customers behind its conversations, narrowed by a chip and a search. */
export const useChatbotCustomers = (installationId: string | null, isActive = true) => {
    const t = useTranslations("workbenchChatbot")
    const workbench = useChatbotWorkbench(installationId, null, isActive)
    const [filter, setFilter] = useState<CustomerFilter>("all")
    const [query, setQuery] = useState("")
    useFeatureReset({
        isActive,
        isReady: true,
        scope: JSON.stringify([installationId, workbench.workspaceId, workbench.userId]),
        onReset: () => {
            setFilter("all")
            setQuery("")
        },
    })
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
        slot: slotOfReads(workbench.reads, () => rows),
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
