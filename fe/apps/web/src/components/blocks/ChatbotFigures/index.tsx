"use client"

import { useTranslations } from "next-intl"
import { useChatbotWorkbench } from "@/hooks/chatbotWorkbench"
import { ChatbotFiguresBase } from "./component"

/** What the page tells the ribbon. */
interface ChatbotFiguresProps {
    /** The Chatbot instance the workbench opens for. */
    readonly installationId: string | null
}

/** The connected ribbon of one Chatbot instance, read from its inbox snapshot. */
export const ChatbotFigures = (props: ChatbotFiguresProps) => {
    const t = useTranslations("workbenchChatbot")
    const frame = useTranslations("agentDashboard")
    const workbench = useChatbotWorkbench(props.installationId, null)
    return (
        <ChatbotFiguresBase
            props={{
                label: frame("ribbonAria"),
                isLoading: workbench.overview === undefined,
                isFailed: workbench.isFailed,
                failedTitle: frame("regionFailed"),
                failedBody: t("loadError"),
                items: workbench.figures,
            }}
        />
    )
}
