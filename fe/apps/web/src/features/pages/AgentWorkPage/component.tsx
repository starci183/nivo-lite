import type { StoredSpec } from "@nivo-lite/agent-sdk/spec"
import { AgentWorkPanes } from "@/components/blocks/AgentWorkPanes"
import { AgentWorkTabs } from "@/components/blocks/AgentWorkTabs"
import { SpecWorkbenchFrame } from "@/components/blocks/SpecWorkbenchFrame"
import type { AgentWorkViewKey } from "@/modules/agentWork"
import type { ModuleKey } from "@/modules/catalog"

/** The type and the instance whose work the tab draws, the view of the url, and the spec of the runs. */
export interface AgentWorkPageBaseProps {
    readonly props: {
        readonly module: ModuleKey
        readonly installationId: string
        readonly view: AgentWorkViewKey
        readonly runsSpec: StoredSpec
    }
}

/** Draws the work tab of an agent: the line that picks the view, then the panes of its work or the runs list beside the steps of a run, flush under the tab line of the instance frame. */
export const AgentWorkPageBase = (props: AgentWorkPageBaseProps) => (
    <>
        <AgentWorkTabs />
        {props.props.view === "runs" ? (
            <SpecWorkbenchFrame
                module="platform"
                installationId={props.props.installationId}
                spec={props.props.runsSpec}
                fallback={null}
                tab={null}
            />
        ) : (
            <AgentWorkPanes module={props.props.module} installationId={props.props.installationId} />
        )}
    </>
)
