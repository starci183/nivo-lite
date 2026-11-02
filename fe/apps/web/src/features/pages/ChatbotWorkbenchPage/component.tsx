import { ChatbotWorkbench } from "@/components/blocks/ChatbotWorkbench"

/** The instance the workbench opens for. */
interface ChatbotWorkbenchPageBaseProps {
    readonly props: {
        readonly installationId: string | null
        /** The tab the route asks for: customers or gaps. */
        readonly tab: string | null
        /** The conversation of a customer the route opens: the Customers tab then draws its thread. */
        readonly focus: string | null
        readonly customersLabel: string
        readonly gapsLabel: string
    }
}

/**
 * Draws the Chatbot workbench: the agent dashboard frame with the figures, the waiting card and the gaps card (the conversations are in the Inbox tab). The waiting card lists the conversations waiting for a
 * person and the gaps card holds the questions the Chatbot could not answer.
 */
export const ChatbotWorkbenchPageBase = (props: ChatbotWorkbenchPageBaseProps) => {
    return <ChatbotWorkbench {...props.props} />
}
