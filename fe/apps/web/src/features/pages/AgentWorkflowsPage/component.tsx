import { AgentWorkflowsHome } from "@/components/blocks/AgentWorkflowsHome"
import type { ModuleKey } from "@/modules/catalog"

/** The Workflows section of the Setup tab of an agent: the type and the instance of the url. */
export interface AgentWorkflowsPageBaseProps {
    readonly props: {
        readonly module: ModuleKey
        readonly installationId: string
    }
}

/** Draws the Workflows section of Setup: the one connected block that lays the workflows out as panes, nested in the flush pane of the frame. */
export const AgentWorkflowsPageBase = (props: AgentWorkflowsPageBaseProps) => (
    <AgentWorkflowsHome module={props.props.module} installationId={props.props.installationId} />
)
