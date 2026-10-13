import { AgentDashboardFrame } from "@/components/blocks/AgentDashboardFrame"
import { ChatbotFigures } from "@/components/blocks/ChatbotFigures"
import { ChatbotGaps } from "@/components/blocks/ChatbotGaps"
import { ChatbotInbox } from "@/components/blocks/ChatbotInbox"
import { ChatbotWaiting } from "@/components/blocks/ChatbotWaiting"

/** The instance, the conversation the route asks for and the name of the inbox. */
interface ChatbotWorkbenchPageBaseProps {
    readonly props: {
        readonly installationId: string | null
        readonly focus: string | null
        readonly inboxLabel: string
    }
}

/**
 * Draws the Chatbot workbench: the agent dashboard frame around the inbox. The waiting card lists the conversations waiting for a
 * person and the gaps card holds the questions the Chatbot could not answer.
 */
export const ChatbotWorkbenchPageBase = (props: ChatbotWorkbenchPageBaseProps) => {
    const p = props.props
    return (
        <AgentDashboardFrame
            module="chatbot"
            installationId={p.installationId}
            ribbon={<ChatbotFigures installationId={p.installationId} />}
            waiting={<ChatbotWaiting installationId={p.installationId} />}
            gaps={<ChatbotGaps installationId={p.installationId} />}
            tabs={[
                {
                    id: "inbox",
                    label: p.inboxLabel,
                    content: <ChatbotInbox installationId={p.installationId} focus={p.focus} />,
                },
            ]}
        />
    )
}
