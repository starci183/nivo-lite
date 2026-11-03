"use client"

import { useTranslations } from "next-intl"
import { useChatbotInbox } from "@/hooks/chatbotView"
import { useChatbotWorkbench } from "@/hooks/chatbot"
import { slotOfReads, useSlotLabels } from "@/hooks/slot"
import { ChatbotInboxBase } from "./component"

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
                slot: slotOfReads(workbench.reads, () => inbox.props),
                placeholder: inbox.props,
                labels: slotLabels(t("title")),
            }}
            on={{ ...inbox.on, reload: workbench.reload }}
        />
    )
}
