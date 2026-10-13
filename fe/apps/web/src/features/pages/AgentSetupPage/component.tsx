import { AgentSetupChat } from "@/components/blocks/AgentSetupChat"
import { AgentSetupSide } from "@/components/blocks/AgentSetupSide"
import { GRID } from "./classNames"

/** The Setup tab of an agent: the type and the instance of the url. */
export interface AgentSetupPageBaseProps {
    readonly props: {
        readonly module: string
        readonly installationId: string
        /** The short name of the type, for the cards that say whether a fact is for the whole type or for this instance. */
        readonly typeName: string
    }
}

/** Draws the Setup tab of an agent: the private chat with NIVO beside the draft, the checklist, the knowledge and the versions. */
export const AgentSetupPageBase = (props: AgentSetupPageBaseProps) => (
    <div className={GRID}>
        <AgentSetupChat installationId={props.props.installationId} typeName={props.props.typeName} />
        <AgentSetupSide module={props.props.module} installationId={props.props.installationId} />
    </div>
)
