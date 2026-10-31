import { AgentDashboardFrame } from "@/components/blocks/AgentDashboardFrame"
import { ChatbotCustomers } from "@/components/blocks/ChatbotCustomers"
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
        /** The tab the route asks for: inbox, customers or gaps. */
        readonly tab: string | null
        readonly customersLabel: string
        readonly gapsLabel: string
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
            gaps={null}
            initialTab={p.tab ?? (p.focus === null ? null : "inbox")}
            tabs={[
                {
                    id: "inbox",
                    label: p.inboxLabel,
                    content: <ChatbotInbox installationId={p.installationId} focus={p.focus} />,
                },
                {
                    id: "customers",
                    label: p.customersLabel,
                    content: <ChatbotCustomers installationId={p.installationId} />,
                },
                {
                    id: "gaps",
                    label: p.gapsLabel,
                    content: <ChatbotGaps installationId={p.installationId} />,
                },
            ]}
        />
    )
}
