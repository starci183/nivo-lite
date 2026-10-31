import { Page, PrimaryRailLayout, Stack } from "@starci/grammar/common"
import { OnboardingChecklist } from "@/components/blocks/OnboardingChecklist"
import { OverviewGovernance } from "@/components/blocks/OverviewGovernance"
import { OverviewHeader } from "@/components/blocks/OverviewHeader"
import { OverviewKpiBand } from "@/components/blocks/OverviewKpiBand"
import { OverviewOwners } from "@/components/blocks/OverviewOwners"
import { OverviewRail } from "@/components/blocks/OverviewRail"
import { OverviewStatus } from "@/components/blocks/OverviewStatus"

/** The words the overview page supplies. */
export interface OverviewPageBaseProps {
    readonly props: { readonly eyebrow: string }
}

/** P01 Overview: what needs you first, one next action, real counts, open work, agents and recent activity. The head's slots and each region read their own data. */
export const OverviewPageBase = (props: OverviewPageBaseProps) => (
    <Page
        measure="product"
        header={{
            meta: props.props.eyebrow,
            title: <OverviewHeader part="title" />,
            description: <OverviewHeader part="description" />,
            actions: <OverviewHeader part="actions" />,
        }}
    >
        <Stack gap="section">
            <OverviewStatus />
            <OverviewGovernance />
            <OverviewKpiBand />
            <PrimaryRailLayout
                railWidth="standard"
                align="start"
                primary={<OverviewOwners />}
                rail={
                    <Stack gap="region">
                        <OnboardingChecklist />
                        <OverviewRail />
                    </Stack>
                }
            />
        </Stack>
    </Page>
)
