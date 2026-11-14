import { Pane, PaneGrid, PaneSection } from "@starci/grammar/common"
import { AgentGeneralForm } from "@/components/blocks/AgentGeneralForm"
import { AgentIdentityCard } from "@/components/blocks/AgentIdentityCard"
import { AgentActivityCard } from "@/components/blocks/AgentActivityCard"
import { AgentProfileOwner } from "@/components/blocks/AgentProfileOwner"
import { AgentRemoveCard } from "@/components/blocks/AgentRemoveCard"
import type { ModuleKey } from "@/modules/catalog"
import type { ModuleIconName } from "@/modules/types"

/** The facts of the type and the instance the cards of the section read; undefined on the loading route, whose cards read the address. */
export interface AgentGeneralPageBaseProps {
    readonly props: {
        readonly module: ModuleKey | undefined
        readonly installationId: string | undefined
        readonly glyph: ModuleIconName | undefined
        /** Whether the form carries the reply limits of a chatbot. */
        readonly hasReplyLimits: boolean | undefined
        /** The heading of the card that groups the work switch and the reply switch. */
        readonly activityTitle: string
        /** False for an internal agent (Sales): the switch that lets it answer customers is left out. */
        readonly answersCustomers: boolean | undefined
    }
}

/**
 * Draws the "Chung" section of Setup as separate cards under sublabels: the picture, the form (details, working hours calendar, reply
 * limits of a chatbot) with its one footer, then who answers for the agent, its activity and its removal.
 */
export const AgentGeneralPageBase = (props: AgentGeneralPageBaseProps) => {
    const { module, installationId, glyph, activityTitle } = props.props
    return (
        <PaneGrid label={activityTitle} areas={{ base: ["main"] }} columns={{ base: ["fill"] }}>
            <Pane area="main" scroll content="cards" label={activityTitle}>
                <PaneSection gap="section">
                    <AgentIdentityCard installationId={installationId} module={module} glyph={glyph} />
                    <AgentGeneralForm
                        installationId={installationId}
                        module={module}
                        hasReplyLimits={props.props.hasReplyLimits}
                        isInternal={props.props.answersCustomers === undefined ? undefined : !props.props.answersCustomers}
                    />
                    <AgentProfileOwner installationId={installationId} />
                    <AgentActivityCard installationId={installationId} module={module} answersCustomers={props.props.answersCustomers} />
                    <AgentRemoveCard installationId={installationId} module={module} />
                </PaneSection>
            </Pane>
        </PaneGrid>
    )
}
