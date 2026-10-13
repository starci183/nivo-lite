import { ChatbotWorkbenchOverview } from "@/components/blocks/ChatbotWorkbenchOverview"

/** The instance and the conversation the route asks for. */
interface ChatbotWorkbenchBaseProps {
    readonly props: { readonly installationId: string | undefined; readonly focus: string | null }
}

/** The Chatbot workbench: the connected frame with the inbox, keyed by instance so one instance never shows another's state. */
export const ChatbotWorkbenchBase = (props: ChatbotWorkbenchBaseProps) => (
    <ChatbotWorkbenchOverview
        key={props.props.installationId ?? "all"}
        installationId={props.props.installationId}
        focus={props.props.focus}
    />
)
