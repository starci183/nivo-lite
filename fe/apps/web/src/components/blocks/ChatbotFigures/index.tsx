"use client"

import { useTranslations } from "next-intl"
import { useChatbotWorkbench } from "@/hooks/chatbotWorkbench"
import { slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { ChatbotFiguresBase } from "./component"

/** What the page tells the ribbon. */
interface ChatbotFiguresProps {
    /** The Chatbot instance the workbench opens for. */
    readonly installationId: string | null
}

/** The connected ribbon of one Chatbot instance, read from its inbox snapshot. */
export const ChatbotFigures = (props: ChatbotFiguresProps) => {
    const frame = useTranslations("agentDashboard")
    const t = useTranslations("workbenchChatbot")
    const slotLabels = useSlotLabels()
    const workbench = useChatbotWorkbench(props.installationId, null)
    return (
        <ChatbotFiguresBase
            props={{
                label: frame("ribbonAria"),
                slot: slotOfSwr({
                    data: workbench.overview === undefined ? undefined : workbench.figures,
                    error: workbench.isFailed ? t("loadError") : undefined,
                    isLoading: workbench.overview === undefined && !workbench.isFailed,
                }),
                labels: slotLabels(t("loadError")),
                placeholder: workbench.figures,
            }}
            on={{ retry: workbench.reload }}
        />
    )
}
