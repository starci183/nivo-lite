"use client"

import { useTranslations } from "next-intl"
import { useChatbotInbox } from "@/hooks/chatbotView"
import { useChatbotWorkbench } from "@/hooks/chatbotWorkbench"
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
    const workbench = useChatbotWorkbench(props.installationId, props.focus)
    const inbox = useChatbotInbox(workbench)
    return (
        <ChatbotInboxBase
            props={{
                inbox: inbox === null ? null : inbox.props,
                pending: { label: t("title"), failure: workbench.failure, onRetry: workbench.reload },
            }}
            on={{
                query: (query) => inbox?.on.query(query),
                filter: (filter) => inbox?.on.filter(filter),
                select: (id) => inbox?.on.select(id),
                back: () => inbox?.on.back(),
                toggleInfo: () => inbox?.on.toggleInfo(),
                draft: (draft) => inbox?.on.draft(draft),
                send: () => inbox?.on.send(),
                toggleHandling: () => inbox?.on.toggleHandling(),
                escalationDraft: (draft) => inbox?.on.escalationDraft(draft),
                answer: (send) => inbox?.on.answer(send),
            }}
        />
    )
}
