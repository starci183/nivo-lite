import { Divider } from "@starci/grammar/common"
import { AgentSetupChat } from "@/components/blocks/AgentSetupChat"
import { AgentSetupSide } from "@/components/blocks/AgentSetupSide"
import type { ModuleKey } from "@/modules/catalog"
import { CHAT_COLUMN, SEPARATOR_HORIZONTAL, SIDE_COLUMN, SPLIT } from "./classNames"

/** The Setup tab of an agent: the type and the instance of the url. */
export interface AgentSetupPageBaseProps {
    readonly props: {
        readonly module: ModuleKey
        readonly installationId: string
    }
}

/** Draws the Setup tab of an agent: the private chat with NIVO and, past a vertical line, what must be done before it runs. */
export const AgentSetupPageBase = (props: AgentSetupPageBaseProps) => (
    <div className={SPLIT} data-bleed>
        <div className={CHAT_COLUMN}>
            <AgentSetupChat installationId={props.props.installationId} module={props.props.module} />
        </div>
        <div className={SEPARATOR_HORIZONTAL}>
            <Divider semantics="presentation" />
        </div>
        <div className={SIDE_COLUMN}>
            <AgentSetupSide module={props.props.module} installationId={props.props.installationId} />
        </div>
    </div>
)
