import { ChatbotInbox } from "@/components/blocks/ChatbotInbox"

/** The instance and the conversation the route asks for. */
interface ChatbotInboxPageBaseProps {
    readonly props: {
        readonly installationId: string
        readonly focus: string | null
    }
}

/** Draws the Chatbot inbox as the panes body of the instance frame: the one connected block lays the list, the thread and the customer pane out. */
export const ChatbotInboxPageBase = (props: ChatbotInboxPageBaseProps) => (
    <ChatbotInbox installationId={props.props.installationId} focus={props.props.focus} />
)
