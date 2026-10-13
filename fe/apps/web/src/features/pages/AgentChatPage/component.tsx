import { AgentChat } from "@/components/blocks/AgentChat"
import type { AgentChatTab } from "@/components/blocks/AgentChat"

/** Props for {@link AgentChatPageBase}. */
export interface AgentChatPageBaseProps {
    readonly props: {
        /** Undefined renders the route's loading frame without starting a query. */
        readonly agentId: string | undefined
        readonly initialTab: AgentChatTab
        readonly initialConversationId: string | null
        readonly welcome: boolean
    }
}

/** The agent chat page body: the full-bleed chat of one agent. */
export const AgentChatPageBase = ({ props }: AgentChatPageBaseProps) => (
    <AgentChat
        key={props.agentId}
        agentId={props.agentId}
        initialTab={props.initialTab}
        initialConversationId={props.initialConversationId}
        welcome={props.welcome}
    />
)
