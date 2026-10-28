import { PageContainer, PrimaryRailLayout } from "@starci/grammar/common"
import { FoundingOffer } from "@/components/blocks/FoundingOffer"
import { OnboardingChecklist } from "@/components/blocks/OnboardingChecklist"
import { OverviewGovernance } from "@/components/blocks/OverviewGovernance"
import { OverviewHeader } from "@/components/blocks/OverviewHeader"
import { OverviewKpiBand } from "@/components/blocks/OverviewKpiBand"
import { OverviewOwners } from "@/components/blocks/OverviewOwners"
import { OverviewRail } from "@/components/blocks/OverviewRail"
import { OverviewStatus } from "@/components/blocks/OverviewStatus"
import { PAGE_CLASS_NAME, PAGE_INSET_CLASS_NAME, RAIL_CLASS_NAME } from "./classNames"

/** P01 Overview: what needs you first, one next action, real counts, open work, agents and recent activity. Each region reads its own data. */
export const OverviewPageBase = () => (
    <>
        <OverviewHeader />
        <PageContainer measure="product">
            <div className={PAGE_INSET_CLASS_NAME}>
                <div className={PAGE_CLASS_NAME}>
                    <OverviewStatus />
                    <OverviewGovernance />
                    <OverviewKpiBand />
                    <PrimaryRailLayout
                        railWidth="standard"
                        align="start"
                        primary={<OverviewOwners />}
                        rail={
                            <div className={RAIL_CLASS_NAME}>
                                <OnboardingChecklist />
                                <OverviewRail />
                            </div>
                        }
                    />
                    <FoundingOffer variant="hero" />
                </div>
            </div>
        </PageContainer>
    </>
)
