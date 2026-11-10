import { Pane, PaneGrid, PaneSection } from "@starci/grammar/common"
import { AgentGeneralForm } from "@/components/blocks/AgentGeneralForm"
import { AgentIdentityCard } from "@/components/blocks/AgentIdentityCard"
import { AgentActivityCard } from "@/components/blocks/AgentActivityCard"
import { AgentModeCard } from "@/components/blocks/AgentModeCard"
import { AgentProfileOwner } from "@/components/blocks/AgentProfileOwner"
import { AgentRemoveCard } from "@/components/blocks/AgentRemoveCard"
import { AgentSyncCard } from "@/components/blocks/AgentSyncCard"
import type { ModuleKey } from "@/modules/catalog"
import type { ModuleIconName } from "@/modules/types"

/** The facts of the type and the instance the cards of the section read. */
export interface AgentGeneralPageBaseProps {
    readonly props: {
        readonly module: ModuleKey
        readonly installationId: string
        readonly glyph: ModuleIconName
        /** The extra card of the type, by its catalogue key; null when it has none. */
        readonly extrasKey: string | null
        /** The heading of the card that groups the work switch, the reply switch and the operating mode. */
        readonly activityTitle: string
        /** False for an internal agent (Sales, Accounting): the switch that lets it answer customers is left out. */
        readonly answersCustomers: boolean
    }
}

/**
 * Draws the "Chung" section of Setup as separate cards under sublabels: the picture, the form (details, working hours calendar, reply
 * limits of a chatbot) with its one footer, then who answers for the agent, its activity, mode, copy and removal.
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
                        hasReplyLimits={props.props.extrasKey === "chatbot_reply"}
                        isInternal={!props.props.answersCustomers}
                    />
                    <AgentProfileOwner installationId={installationId} />
                    <AgentActivityCard installationId={installationId} module={module} answersCustomers={props.props.answersCustomers} />
                    <AgentModeCard installationId={installationId} module={module} />
                    <AgentSyncCard installationId={installationId} />
                    <AgentRemoveCard installationId={installationId} module={module} />
                </PaneSection>
            </Pane>
        </PaneGrid>
    )
}
