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
 * Draws the profile of an agent: the heading with the Assign command (a dialog) and its menu (picture and name, in a dialog), the
 * recent work as the main column, and the owner, who may assign, whom it may tag and its rules as the rail beside it.
 */
export const AgentProfilePageBase = (props: AgentProfilePageBaseProps) => {
    const { agentId } = props.props
    return (
        <AgentProfileHead agentId={agentId}>
            <AgentProfileIdentity agentId={agentId} />
            <AgentProfileRecent agentId={agentId} />
            <AgentProfileOwner agentId={agentId} />
            <AgentProfileAssignable agentId={agentId} />
            <AgentProfileTags agentId={agentId} />
            <AgentProfileRules agentId={agentId} />
        </AgentProfileHead>
    )
}
