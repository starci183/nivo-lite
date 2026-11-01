import { AgentDashboardFrame } from "@/components/blocks/AgentDashboardFrame"
import { ChatbotCustomers } from "@/components/blocks/ChatbotCustomers"
import { ChatbotFigures } from "@/components/blocks/ChatbotFigures"
import { ChatbotGaps } from "@/components/blocks/ChatbotGaps"
import { ChatbotWaiting } from "@/components/blocks/ChatbotWaiting"

/** The instance the workbench opens for. */
interface ChatbotWorkbenchPageBaseProps {
    readonly props: {
        readonly installationId: string | null
        /** The tab the route asks for: customers or gaps. */
        readonly tab: string | null
        readonly customersLabel: string
        readonly gapsLabel: string
    }
}

/**
 * Draws the Chatbot workbench: the agent dashboard frame with the figures, the waiting card and the gaps card (the conversations are in the Inbox tab). The waiting card lists the conversations waiting for a
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
            initialTab={p.tab}
            tabs={[
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
