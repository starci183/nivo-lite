import { Grid, Stack } from "@starci/grammar/common"
import { AgentProfileAssignable } from "@/components/blocks/AgentProfileAssignable"
import { AgentProfileHead } from "@/components/blocks/AgentProfileHead"
import { AgentProfileIdentity } from "@/components/blocks/AgentProfileIdentity"
import { AgentProfileOwner } from "@/components/blocks/AgentProfileOwner"
import { AgentProfileRecent } from "@/components/blocks/AgentProfileRecent"
import { AgentProfileRules } from "@/components/blocks/AgentProfileRules"
import { AgentProfileTags } from "@/components/blocks/AgentProfileTags"

/** The agent the page is about. */
export interface AgentProfilePageBaseProps {
    readonly props: { readonly agentId: string }
}

/**
 * Draws the profile of an agent: heading with the composer, its picture and name for a manager to edit, owner and rules on the
 * left, who may assign and whom it may tag on the right, recent work below.
 */
export const AgentProfilePageBase = (props: AgentProfilePageBaseProps) => {
    const { agentId } = props.props
    return (
        <AgentProfileHead agentId={agentId}>
            <Stack gap="region">
                <AgentProfileIdentity agentId={agentId} />
                <Grid kind="cards" columns={2}>
                    <Stack gap="region">
                        <AgentProfileOwner agentId={agentId} />
                        <AgentProfileRules agentId={agentId} />
                    </Stack>
                    <Stack gap="region">
                        <AgentProfileAssignable agentId={agentId} />
                        <AgentProfileTags agentId={agentId} />
                    </Stack>
                </Grid>
                <AgentProfileRecent agentId={agentId} />
            </Stack>
        </AgentProfileHead>
    )
}
