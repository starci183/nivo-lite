import { AgentRunsPanes } from "@/components/blocks/AgentRunsPanes"
import { AgentWorkPanes } from "@/components/blocks/AgentWorkPanes"
import type { AgentWorkViewKey } from "@/modules/agentWork"
import type { ModuleKey } from "@/modules/catalog"

/** The type and the instance whose work the tab draws, and the view of the url. */
export interface AgentWorkPageBaseProps {
    readonly props: {
        readonly module: ModuleKey | undefined
        readonly installationId: string | undefined
        readonly view: AgentWorkViewKey
    }
}

/** Draws the work tab of an agent: the region tabs on the chrome, then the runs of the agent (the workflows beside the table) or the well with the work cards. */
export const AgentWorkPageBase = (props: AgentWorkPageBaseProps) =>
    props.props.view === "runs" ? (
        <AgentRunsPanes module={props.props.module} installationId={props.props.installationId} />
    ) : (
        <AgentWorkPanes module={props.props.module} installationId={props.props.installationId} />
    )
