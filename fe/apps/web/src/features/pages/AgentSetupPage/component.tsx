import { AgentSetupChat } from "@/components/blocks/AgentSetupChat"
import { AgentSetupSide } from "@/components/blocks/AgentSetupSide"
import type { ModuleKey } from "@/modules/catalog"
import { GRID } from "./classNames"

/** The Setup tab of an agent: the type and the instance of the url. */
export interface AgentSetupPageBaseProps {
    readonly props: {
        readonly module: ModuleKey
        readonly installationId: string
    }
}

/** Draws the Setup tab of an agent: the private chat with NIVO beside the draft, the checklist, the knowledge and the versions. */
export const AgentSetupPageBase = (props: AgentSetupPageBaseProps) => (
    <div className={GRID}>
        <AgentSetupChat installationId={props.props.installationId} module={props.props.module} />
        <AgentSetupSide module={props.props.module} installationId={props.props.installationId} />
    </div>
)
