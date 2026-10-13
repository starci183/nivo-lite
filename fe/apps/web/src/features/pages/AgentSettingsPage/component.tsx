import { AgentAutomations } from "@/components/blocks/AgentAutomations"
import { AgentConnectionAccess } from "@/components/blocks/AgentConnectionAccess"
import { AgentIdentityCard } from "@/components/blocks/AgentIdentityCard"
import { AgentLiveCard } from "@/components/blocks/AgentLiveCard"
import { LoyaltyProgramSettings } from "@/components/blocks/LoyaltyProgramSettings"
import { AgentModeCard } from "@/components/blocks/AgentModeCard"
import { AgentReplyCard } from "@/components/blocks/AgentReplyCard"
import { AgentSyncCard } from "@/components/blocks/AgentSyncCard"
import { COLUMN, GRID } from "./classNames"

/** The facts of the type and the instance the settings cards read. */
export interface AgentSettingsPageBaseProps {
    readonly props: {
        readonly module: string
        readonly installationId: string
        readonly glyph: string
        /** The short name of the type, for the note that its authority is shared. */
        readonly typeName: string
        /** The extra card of the type, by its catalogue key; null when it has none. */
        readonly extrasKey: string | null
    }
}

/** Draws the settings of an agent: its name, mode and live switch, the connections it uses, its automations and sync, and the extra card of its type. */
export const AgentSettingsPageBase = (props: AgentSettingsPageBaseProps) => {
    const { module, installationId } = props.props
    return (
        <div className={GRID}>
            <div className={COLUMN}>
                <AgentIdentityCard installationId={installationId} module={module} glyph={props.props.glyph} />
                <AgentModeCard installationId={installationId} module={module} typeName={props.props.typeName} />
            </div>
            <div className={COLUMN}>
                <AgentLiveCard installationId={installationId} module={module} />
                <AgentConnectionAccess installationId={installationId} module={module} />
                <AgentAutomations />
                <AgentSyncCard installationId={installationId} />
                {props.props.extrasKey === "chatbot_reply" ? (
                    <AgentReplyCard installationId={installationId} module={module} />
                ) : null}
                {props.props.extrasKey === "loyalty_program" ? <LoyaltyProgramSettings /> : null}
            </div>
        </div>
    )
}
