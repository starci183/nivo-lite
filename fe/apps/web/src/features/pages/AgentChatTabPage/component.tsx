import { Pane, PaneGrid } from "@starci/grammar/common"
import { AgentTeamChatRoom } from "@/components/blocks/TeamChatRoom"
import type { ModuleKey } from "@/modules/catalog"

/** The type and the instance whose chat the tab draws. */
export interface AgentChatTabPageBaseProps {
    readonly props: {
        readonly module: ModuleKey
        readonly installationId: string
        readonly label: string
    }
}

/** Draws the chat tab of an agent: the room block in one pane, flush under the tab line of the instance frame. */
export const AgentChatTabPageBase = (props: AgentChatTabPageBaseProps) => (
    <PaneGrid label={props.props.label} areas={["room"]}>
        <Pane area="room" surface>
            <AgentTeamChatRoom module={props.props.module} installationId={props.props.installationId} />
        </Pane>
    </PaneGrid>
)
