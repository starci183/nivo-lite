import { AgentWorkPanes } from "@/components/blocks/AgentWorkPanes"
import type { ModuleKey } from "@/modules/catalog"

/** The type and the instance whose work the tab draws. */
export interface AgentWorkPageBaseProps {
    readonly props: {
        readonly module: ModuleKey
        readonly installationId: string
    }
}

/** Draws the work tab of an agent: the panes of its work, flush under the tab line of the instance frame. */
export const AgentWorkPageBase = (props: AgentWorkPageBaseProps) => (
    <AgentWorkPanes module={props.props.module} installationId={props.props.installationId} />
)
