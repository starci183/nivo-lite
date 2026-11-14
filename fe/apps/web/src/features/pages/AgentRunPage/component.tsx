import { AgentRunPanes } from "@/components/blocks/AgentRunPanes"
import { LeadFreeze } from "@/components/blocks/LeadFreeze"
import type { ModuleKey } from "@/modules/catalog"

/** The type, the instance and the run whose page this is. */
export interface AgentRunPageBaseProps {
    readonly props: {
        readonly module: ModuleKey | undefined
        readonly installationId: string | undefined
        readonly runId: string | undefined
    }
}

/**
 * Draws the page of one run of an agent: the freeze of the lead the run serves (nothing when it is not frozen; it reads the run from the
 * route) above the panes of the run: the head, the map and the selected step.
 */
export const AgentRunPageBase = (props: AgentRunPageBaseProps) => (
    <>
        <LeadFreeze />
        <AgentRunPanes
            module={props.props.module}
            installationId={props.props.installationId}
            runId={props.props.runId}
        />
    </>
)
