import { AgentSetupPanes } from "@/components/blocks/AgentSetupPanes"
import type { ModuleKey } from "@/modules/catalog"

/** The Setup tab of an agent: the type and the instance of the url. */
export interface AgentSetupPageBaseProps {
    readonly props: {
        readonly module: ModuleKey
        readonly installationId: string
    }
}

/**
 * Draws the Setup tab of an agent: the one connected block that lays the checklist and the chat with NIVO out as panes, nested in
 * the flush pane the instance frame attaches under its tab line.
 */
export const AgentSetupPageBase = (props: AgentSetupPageBaseProps) => (
    <AgentSetupPanes module={props.props.module} installationId={props.props.installationId} />
)
