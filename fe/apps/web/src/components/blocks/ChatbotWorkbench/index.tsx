"use client"

import { useChatbotWorkbenchView } from "@/hooks/chatbotWorkbench"
import { ChatbotWorkbenchBase } from "./component"

/** The existing installation, focused conversation and resolved route labels. */
type ChatbotWorkbenchProps = Parameters<typeof useChatbotWorkbenchView>[0]

/** Owns the Chatbot world and renders only its atom-input workbench twin. */
export const ChatbotWorkbench = (props: ChatbotWorkbenchProps) => {
    const view = useChatbotWorkbenchView(props)
    return <ChatbotWorkbenchBase {...view} />
}
