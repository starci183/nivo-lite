"use client"

import { useChatbotGaps } from "@/hooks/chatbot"
import { useChatbotWorkbench } from "@/hooks/chatbotWorkbench"
import { useSlotLabels } from "@/hooks/slot"
import { ChatbotGapsBase } from "./component"

/** What the page tells the card. */
interface ChatbotGapsProps {
    /** The Chatbot instance the workbench opens for. */
    readonly installationId: string | null
}

/** The connected unanswered-questions card of the Chatbot workbench, for a manager. */
export const ChatbotGaps = (props: ChatbotGapsProps) => {
    const slotLabels = useSlotLabels()
    const workbench = useChatbotWorkbench(props.installationId, null)
    const gaps = useChatbotGaps(workbench.workspaceId, workbench.canFillGaps)
    if (!workbench.canFillGaps) return null
    return (
        <ChatbotGapsBase
            props={{
                id: "chatbot-gaps-title",
                title: gaps.title,
                description: gaps.description,
                slot: gaps.slot,
                slotLabels: slotLabels(gaps.emptyTitle),
                isPending: gaps.isPending,
            }}
            on={{
                reload: gaps.reload,
                dismiss: (id) => {
                    void gaps.dismiss(id)
                },
            }}
        />
    )
}
