import { AgentProfileAssignable } from "@/components/blocks/AgentProfileAssignable"
import { AgentProfileHead } from "@/components/blocks/AgentProfileHead"
import { AgentProfileIdentity } from "@/components/blocks/AgentProfileIdentity"
import { AgentProfileOwner } from "@/components/blocks/AgentProfileOwner"
import { AgentProfileRecent } from "@/components/blocks/AgentProfileRecent"
import { AgentProfileRules } from "@/components/blocks/AgentProfileRules"
import { AgentProfileTags } from "@/components/blocks/AgentProfileTags"
import { COLUMN_CLASS, GRID_CLASS, PAGE_CLASS } from "./classNames"

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
            <div className={PAGE_CLASS}>
                <AgentProfileIdentity agentId={agentId} />
                <div className={GRID_CLASS}>
                    <div className={COLUMN_CLASS}>
                        <AgentProfileOwner agentId={agentId} />
                        <AgentProfileRules agentId={agentId} />
                    </div>
                    <div className={COLUMN_CLASS}>
                        <AgentProfileAssignable agentId={agentId} />
                        <AgentProfileTags agentId={agentId} />
                    </div>
                </div>
                <AgentProfileRecent agentId={agentId} />
            </div>
        </AgentProfileHead>
    )
}
