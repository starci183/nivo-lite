import { AgentConnections } from "@/components/blocks/AgentConnections"
import type { ModuleKey } from "@/modules/catalog"

/** The workspace, type and instance the connections tab draws. */
export interface AgentConnectionsPageBaseProps {
    readonly props: {
        readonly workspaceId: string
        readonly module: ModuleKey
        readonly installationId: string
    }
}

/** Draws the connections tab of an agent: the block that lists its grants. */
export const AgentConnectionsPageBase = (props: AgentConnectionsPageBaseProps) => <AgentConnections {...props.props} />
