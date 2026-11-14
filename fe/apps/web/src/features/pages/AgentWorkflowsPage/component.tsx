import { AgentWorkflowsHome } from "@/components/blocks/AgentWorkflowsHome"
import type { ModuleKey } from "@/modules/catalog"

/** The Workflows tab of an agent: the type and the instance of the url. */
export interface AgentWorkflowsPageBaseProps {
    readonly props: {
        readonly module: ModuleKey | undefined
        readonly installationId: string | undefined
    }
}

/** Draws the Workflows tab: the one connected block that holds the readiness card, the table of workflows and the maker of a workflow. */
export const AgentWorkflowsPageBase = (props: AgentWorkflowsPageBaseProps) => (
    <AgentWorkflowsHome module={props.props.module} installationId={props.props.installationId} />
)
