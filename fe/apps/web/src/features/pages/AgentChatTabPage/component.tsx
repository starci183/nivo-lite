import { AgentTeamChatPanes } from "@/components/blocks/TeamChatRoom"

/** The instance whose chat the tab draws, and the names of its panes. */
export interface AgentChatTabPageBaseProps {
    readonly props: {
        readonly installationId: string
        readonly gridLabel: string
        readonly roomLabel: string
    }
}

/**
 * Draws the chat tab of an agent, flush under the tab line of the instance frame: the one chat room of the app opened on the
 * direct room with the agent, a pane whose body is the thread and whose footer is the composer.
 */
export const AgentChatTabPageBase = (page: AgentChatTabPageBaseProps) => (
    <AgentTeamChatPanes
        installationId={page.props.installationId}
        gridLabel={page.props.gridLabel}
        roomLabel={page.props.roomLabel}
    />
)
