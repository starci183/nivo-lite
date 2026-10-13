import { AgentChat } from "@/components/blocks/AgentChat"
import type { AgentChatTab } from "@/components/blocks/AgentChat"

/** Props for {@link AgentChatPageBase}. */
export interface AgentChatPageBaseProps {
    readonly props: {
        /** Null while the agent loads (STATE-8: the same chat with skeletons). */
        readonly agent: {
            readonly id: string
            readonly module: string
            readonly name: string
            readonly handle: string
            readonly role: string
            readonly isActive: boolean
            readonly hasCustomerChannel: boolean
        } | null
        readonly workspaceId: string | null
        readonly initialTab: AgentChatTab
        readonly initialConversationId: string | null
        readonly showWelcome: boolean
    }
}

/** The agent chat page body: the full-bleed chat of one agent. */
export const AgentChatPageBase = ({ props }: AgentChatPageBaseProps) => (
    <AgentChat
        agent={props.agent}
        workspaceId={props.workspaceId}
        initialTab={props.initialTab}
        initialConversationId={props.initialConversationId}
        showWelcome={props.showWelcome}
        isLoading={props.agent === null}
    />
)
