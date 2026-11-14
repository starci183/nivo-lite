import { AgentConnections } from "@/components/blocks/AgentConnections"
import { AgentStepRights } from "@/components/blocks/AgentStepRights"
import type { ModuleKey } from "@/modules/catalog"

/** The workspace, type and instance the connections tab draws. */
export interface AgentConnectionsPageBaseProps {
    readonly props: {
        readonly workspaceId: string | undefined
        readonly module: ModuleKey | undefined
        readonly installationId: string | undefined
    }
}

/** Draws the rights tab of an agent: the block that holds its accounts, with the read-only roll-up of what its steps call under them. */
export const AgentConnectionsPageBase = (props: AgentConnectionsPageBaseProps) => (
    <AgentConnections {...props.props} rollup={<AgentStepRights {...props.props} />} />
)
