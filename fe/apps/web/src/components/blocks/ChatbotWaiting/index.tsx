"use client"

import { useTranslations } from "next-intl"
import { useChatbotWorkbench } from "@/hooks/chatbotWorkbench"
import { slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { ChatbotWaitingBase } from "./component"

/** What the page tells the card. */
interface ChatbotWaitingProps {
    /** The Chatbot instance the workbench opens for. */
    readonly installationId: string | null
}

/** The connected "waiting for you" card of one Chatbot instance: its waiting conversations, each opening the inbox on it. */
export const ChatbotWaiting = (props: ChatbotWaitingProps) => {
    const t = useTranslations("agentDashboard")
    const slotLabels = useSlotLabels()
    const workbench = useChatbotWorkbench(props.installationId, null)
    const { total, rows } = workbench.waiting
    return (
        <ChatbotWaitingBase
            props={{
                label: t("waitingTitle"),
                slot: slotOfSwr({
                    data:
                        workbench.overview === undefined
                            ? undefined
                            : {
                                  count: total > 0 ? String(total) : null,
                                  rows,
                                  openLabel: t("waitingOpen"),
                                  more: total > rows.length ? t("waitingMore", { n: total - rows.length }) : null,
                                  emptyMessage: t("waitingEmpty"),
                                  emptyDescription: t("waitingEmptyBody"),
                              },
                    error: workbench.isFailed ? t("regionFailedText") : undefined,
                    isLoading: workbench.overview === undefined && !workbench.isFailed,
                }),
                slotLabels: slotLabels(t("waitingEmpty")),
            }}
            on={{ retry: workbench.reload }}
        />
    )
}
