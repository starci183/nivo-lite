"use client"

import { useTranslations } from "next-intl"
import { useChatbotCustomers } from "@/hooks/chatbotCustomers"
import { useSlotLabels } from "@/hooks/slot"
import { ChatbotCustomersBase } from "./component"

/** What the page tells the tab. */
interface ChatbotCustomersProps {
    /** The Chatbot instance the workbench opens for. */
    readonly installationId: string | null
}

/** The connected Customers tab of one Chatbot instance. */
export const ChatbotCustomers = (props: ChatbotCustomersProps) => {
    const t = useTranslations("workbenchChatbot")
    const slotLabels = useSlotLabels()
    const customers = useChatbotCustomers(props.installationId)
    return (
        <ChatbotCustomersBase
            props={{
                words: {
                    label: t("tabCustomers"),
                    searchLabel: t("searchLabel"),
                    searchPlaceholder: t("customersSearchPlaceholder"),
                    clearLabel: t("clearSearch"),
                    filtersLabel: t("customersFilters"),
                    customer: t("colCustomer"),
                    channel: t("colChannel"),
                    stage: t("colStage"),
                    need: t("colNeed"),
                    replying: t("colReplying"),
                    emptyMessage: t("customersEmpty"),
                    emptyDescription: t("customersEmptyBody"),
                    full: customers.full,
                },
                slot: customers.slot,
                slotLabels: slotLabels(t("customersEmpty")),
                query: customers.query,
                filter: customers.filter,
                chips: customers.chips,
                isFull: customers.isFull,
            }}
            on={{ query: customers.setQuery, filter: customers.setFilter, retry: customers.reload }}
        />
    )
}
