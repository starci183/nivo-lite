"use client"

import { useTranslations } from "next-intl"
import { useChatbotInbox } from "@/hooks/chatbotView"
import { useChatbotWorkbench } from "@/hooks/chatbotWorkbench"
import { loadingSlot, useSlotLabels } from "@/hooks/slot"
import type { DataSlot } from "@/modules/types"
import { ChatbotInboxBase, type ChatbotInboxView } from "./component"

/** What the page tells the inbox. */
interface ChatbotInboxProps {
    /** The Chatbot instance the workbench opens for. */
    readonly installationId: string | null
    /** The conversation the route opens (`?focus=`). */
    readonly focus: string | null
}

/** The connected inbox of one Chatbot instance: conversations, the open thread, replies and escalation answers. */
export const ChatbotInbox = (props: ChatbotInboxProps) => {
    const t = useTranslations("workbenchChatbot")
    const slotLabels = useSlotLabels()
    const workbench = useChatbotWorkbench(props.installationId, props.focus)
    const inbox = useChatbotInbox(workbench)
    return (
        <ChatbotInboxBase
            props={{
                slot: slotOf(workbench, inbox.props),
                placeholder: inbox.props,
                labels: slotLabels(t("title")),
            }}
            on={{ ...inbox.on, reload: workbench.reload }}
        />
    )
}

/** The inbox as a slot: the view once the snapshot is read, an error when it failed, else loading. */
const slotOf = (
    workbench: ReturnType<typeof useChatbotWorkbench>,
    view: ChatbotInboxView,
): DataSlot<ChatbotInboxView> => {
    if (workbench.overview !== undefined) return { items: view }
    if (workbench.isFailed) return { isError: true }
    return workbench.isLoading ? loadingSlot() : {}
}
