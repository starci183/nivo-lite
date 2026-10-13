"use client"

import { useTranslations } from "next-intl"
import { useChatbotWorkbench } from "@/hooks/chatbotWorkbench"
import { ChatbotWaitingBase } from "./component"

/** What the page tells the card. */
interface ChatbotWaitingProps {
    /** The Chatbot instance the workbench opens for. */
    readonly installationId: string | null
}

/** The connected "waiting for you" card of one Chatbot instance: its waiting conversations, each opening the inbox on it. */
export const ChatbotWaiting = (props: ChatbotWaitingProps) => {
    const t = useTranslations("agentDashboard")
    const workbench = useChatbotWorkbench(props.installationId, null)
    const { total, rows } = workbench.waiting
    return (
        <ChatbotWaitingBase
            props={{
                label: t("waitingTitle"),
                isLoading: workbench.overview === undefined && !workbench.isFailed,
                isFailed: workbench.isFailed,
                view: {
                    count: total > 0 ? String(total) : null,
                    rows,
                    openLabel: t("waitingOpen"),
                    more: total > rows.length ? t("waitingMore", { n: total - rows.length }) : null,
                    emptyMessage: t("waitingEmpty"),
                    emptyDescription: t("waitingEmptyBody"),
                },
                failure: { title: t("regionFailed"), description: t("regionFailedText"), retryLabel: t("retry") },
            }}
            on={{ retry: workbench.reload }}
        />
    )
}
