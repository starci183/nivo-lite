"use client"

import { useTranslations } from "next-intl"
import { useChatbotWaiting } from "@/hooks/chatbotWaiting"
import { WAITING_ROWS_PLACEHOLDER, useSlotLabels } from "@/hooks/slot"
import { ChatbotWaitingBase } from "./component"

/** What the page tells the card. */
interface ChatbotWaitingProps {
    /** The Chatbot instance the workbench opens for. */
    readonly installationId: string | null
}

/** The connected "waiting for you" card of one Chatbot instance: its waiting replies, each decided in place. */
export const ChatbotWaiting = (props: ChatbotWaitingProps) => {
    const t = useTranslations("agentDashboard")
    const c = useTranslations("workbenchChatbot")
    const slotLabels = useSlotLabels()
    const waiting = useChatbotWaiting(props.installationId)
    return (
        <ChatbotWaitingBase
            props={{
                slot: waiting.slot,
                placeholder: WAITING_ROWS_PLACEHOLDER,
                slotLabels: slotLabels(t("waitingEmpty")),
                list: {
                    label: t("waitingTitle"),
                    count: waiting.count,
                    more: waiting.more,
                    emptyMessage: t("waitingEmpty"),
                    emptyDescription: t("waitingEmptyBody"),
                    seeWhyLabel: c("waitingSeeWhy"),
                    moreLabel: c("waitingMoreMenu"),
                },
            }}
            on={{ retry: waiting.reload }}
        />
    )
}
