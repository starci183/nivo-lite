import { Grid, Stack } from "@starci/grammar/common"
import type { ModuleIconName } from "@/modules/types"
import { AgentAutomations } from "@/components/blocks/AgentAutomations"
import { AgentConnectionAccess } from "@/components/blocks/AgentConnectionAccess"
import { AgentIdentityCard } from "@/components/blocks/AgentIdentityCard"
import { AgentLiveCard } from "@/components/blocks/AgentLiveCard"
import { LoyaltyProgramSettings } from "@/components/blocks/LoyaltyProgramSettings"
import { AgentModeCard } from "@/components/blocks/AgentModeCard"
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

/** Draws the settings of an agent: its name, mode and live switch, the connections it uses, its automations and sync, and the extra card of its type. */
export const AgentSettingsPageBase = (props: AgentSettingsPageBaseProps) => {
    const { module, installationId } = props.props
    return (
        <Stack gap="region">
            <Grid kind="cards" columns={2}>
                <Stack gap="section">
                    <AgentIdentityCard installationId={installationId} module={module} glyph={props.props.glyph} />
                    <AgentModeCard installationId={installationId} module={module} />
                </Stack>
                <Stack gap="section">
                    <AgentLiveCard installationId={installationId} module={module} />
                    <AgentConnectionAccess installationId={installationId} module={module} />
                    <AgentAutomations />
                    <AgentSyncCard installationId={installationId} />
                    {props.props.extrasKey === "chatbot_reply" ? (
                        <AgentReplyCard installationId={installationId} module={module} />
                    ) : null}
                    {props.props.extrasKey === "loyalty_program" ? <LoyaltyProgramSettings /> : null}
                </Stack>
            </Grid>
            <AgentRemoveCard installationId={installationId} module={module} />
        </Stack>
    )
}
