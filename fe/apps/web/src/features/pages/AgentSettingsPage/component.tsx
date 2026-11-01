import { Grid, Stack } from "@starci/grammar/common"
import type { ModuleIconName } from "@/modules/types"
import { AgentAutomations } from "@/components/blocks/AgentAutomations"
import { AgentConnectionAccess } from "@/components/blocks/AgentConnectionAccess"
import { AgentIdentityCard } from "@/components/blocks/AgentIdentityCard"
import { AgentLiveCard } from "@/components/blocks/AgentLiveCard"
import { LoyaltyProgramSettings } from "@/components/blocks/LoyaltyProgramSettings"
import { AgentModeCard } from "@/components/blocks/AgentModeCard"
import { AgentWorkSwitchCard } from "@/components/blocks/AgentWorkSwitchCard"
import { AgentRemoveCard } from "@/components/blocks/AgentRemoveCard"
import { AgentReplyCard } from "@/components/blocks/AgentReplyCard"
import { AgentSyncCard } from "@/components/blocks/AgentSyncCard"
import type { ModuleKey } from "@/modules/catalog"

/** The facts of the type and the instance the settings cards read. */
export interface AgentSettingsPageBaseProps {
    readonly props: {
        readonly module: ModuleKey
        readonly installationId: string
        readonly glyph: ModuleIconName
        /** The extra card of the type, by its catalogue key; null when it has none. */
        readonly extrasKey: string | null
    }
}

/** Draws the settings of an agent as cards straight on the page ground, two to a row at wide and one at narrow: its name, whether it answers customers, its mode, whether it works, the connections it uses, its automations, its copy and the extra card of its type; removing it is one row at the bottom. */
export const AgentSettingsPageBase = (props: AgentSettingsPageBaseProps) => {
    const { module, installationId } = props.props
    return (
        <Stack gap="region">
            <Grid kind="cards" columns={2}>
                <AgentIdentityCard installationId={installationId} module={module} glyph={props.props.glyph} />
                <AgentLiveCard installationId={installationId} module={module} />
                <AgentModeCard installationId={installationId} module={module} />
                <AgentWorkSwitchCard installationId={installationId} />
                <AgentConnectionAccess installationId={installationId} module={module} />
                {props.props.extrasKey === "chatbot_reply" ? (
                    <AgentReplyCard installationId={installationId} module={module} />
                ) : null}
                {props.props.extrasKey === "loyalty_program" ? <LoyaltyProgramSettings /> : null}
                <AgentAutomations />
                <AgentSyncCard installationId={installationId} />
            </Grid>
            <AgentRemoveCard installationId={installationId} module={module} />
        </Stack>
    )
}
