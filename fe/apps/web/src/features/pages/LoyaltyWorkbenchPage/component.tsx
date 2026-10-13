import { AgentDashboardFrame } from "@/components/blocks/AgentDashboardFrame"
import { LoyaltyFigures } from "@/components/blocks/LoyaltyFigures"
import { LoyaltyMembers } from "@/components/blocks/LoyaltyMembers"
import { LoyaltyOverview } from "@/components/blocks/LoyaltyOverview"
import { LoyaltyPending } from "@/components/blocks/LoyaltyPending"
import { LoyaltyPromo } from "@/components/blocks/LoyaltyPromo"
import { LoyaltyRewards } from "@/components/blocks/LoyaltyRewards"

/** Props for {@link LoyaltyWorkbenchPageBase}. */
export interface LoyaltyWorkbenchPageBaseProps {
    readonly props: {
        readonly installationId: string
        readonly initialTab: string | null
        readonly tabs: {
            readonly overview: string
            readonly members: string
            readonly rewards: string
            readonly promo: string
            readonly pending: string
        }
    }
}

/** Draws the loyalty workbench: the agent dashboard frame around the overview, members, rewards, promotions and pending decisions. */
export const LoyaltyWorkbenchPageBase = (props: LoyaltyWorkbenchPageBaseProps) => {
    const p = props.props
    return (
        <AgentDashboardFrame
            module="loyalty"
            installationId={p.installationId}
            initialTab={p.initialTab}
            figures={[]}
            tabs={[
                {
                    id: "overview",
                    label: p.tabs.overview,
                    content: (
                        <>
                            <LoyaltyFigures />
                            <LoyaltyOverview />
                        </>
                    ),
                },
                { id: "members", label: p.tabs.members, content: <LoyaltyMembers /> },
                { id: "rewards", label: p.tabs.rewards, content: <LoyaltyRewards /> },
                { id: "promo", label: p.tabs.promo, content: <LoyaltyPromo /> },
                { id: "pending", label: p.tabs.pending, content: <LoyaltyPending /> },
            ]}
        />
    )
}
