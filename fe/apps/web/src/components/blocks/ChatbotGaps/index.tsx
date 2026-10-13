"use client"

import { useChatbotGaps } from "@/hooks/chatbot"
import { useChatbotWorkbench } from "@/hooks/chatbotWorkbench"
import { ChatbotGapsBase } from "./component"

/** What the page tells the card. */
interface ChatbotGapsProps {
    /** The Chatbot instance the workbench opens for. */
    readonly installationId: string | null
}

/** The connected unanswered-questions card of the Chatbot workbench, for a manager. */
export const ChatbotGaps = (props: ChatbotGapsProps) => {
    const workbench = useChatbotWorkbench(props.installationId, null)
    const gaps = useChatbotGaps(workbench.workspaceId, workbench.canFillGaps)
    return (
        <ChatbotGapsBase
            props={{ view: gaps.view }}
            on={{
                reload: gaps.reload,
                dismiss: (id) => {
                    void gaps.dismiss(id)
                },
            }}
        />
    )
}
