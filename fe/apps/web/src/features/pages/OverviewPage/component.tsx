import { Button, PageContainer, PrimaryRailLayout, SectionHeader } from "@starci/grammar/common"
import { OverviewGovernance } from "@/components/blocks/OverviewGovernance"
import { OverviewRail } from "@/components/blocks/OverviewRail"
import { OverviewKpis } from "@/components/composites/OverviewKpis"
import { FoundingOffer } from "@/components/blocks/FoundingOffer"
import { OnboardingChecklist } from "@/components/blocks/OnboardingChecklist"
import { OwnerGroups } from "@/features/responsibilities/component"
import type { OwnerGroupModel, ActivityModel } from "@/features/responsibilities/format"
import type { OnboardingStep } from "@/modules/promo"
import type { GovernanceWithStatus } from "@/lib/flow-queries"
import type { WorkItemView } from "@/lib/flow-types"
import type { Agent } from "@/lib/types"
import {
    MAIN_CLASS_NAME,
    PAGE_CLASS_NAME,
    PAGE_INSET_CLASS_NAME,
    ACTIONS_CLASS_NAME,
    RAIL_CLASS_NAME,
} from "./classNames"

/** One count of the KPI band. */
interface OverviewPageKpi {
    readonly id: string
    readonly label: string
    readonly value: number
    readonly href: string
    readonly isAlert: boolean
}

/** The resolved words, links and data of the executive overview. */
interface OverviewPageBaseProps {
    readonly props: {
        readonly eyebrow: string
        readonly title: string
        readonly description: string
        readonly openOfficeLabel: string
        readonly openOfficeHref: string
        readonly newLeadLabel: string
        readonly newLeadHref: string
        readonly newLeadIsPrimary: boolean
        readonly governance: GovernanceWithStatus | null
        readonly waiting: ReadonlyArray<WorkItemView>
        readonly ownerBelowTitle: string
        readonly kpiLabel: string
        readonly kpis: ReadonlyArray<OverviewPageKpi>
        readonly byOwnerTitle: string
        readonly verifiedLabel: string
        readonly groups: ReadonlyArray<OwnerGroupModel>
        readonly emptyMessage: string
        readonly emptyDescription: string
        readonly emptyActionLabel: string
        readonly emptyHref: string
        readonly agents: ReadonlyArray<Agent>
        readonly activity: ReadonlyArray<ActivityModel>
        readonly steps: ReadonlyArray<OnboardingStep>
    }
}

/** P01 Overview: what needs you first, one next action, real counts, open work, agents and recent activity. */
export const OverviewPageBase = (props: OverviewPageBaseProps) => (
    <PageContainer measure="product">
        <div className={PAGE_INSET_CLASS_NAME}>
            <div className={PAGE_CLASS_NAME}>
                <SectionHeader
                    level={1}
                    eyebrow={props.props.eyebrow}
                    title={props.props.title}
                    description={props.props.description}
                    action={
                        <div className={ACTIONS_CLASS_NAME}>
                            <Button variant="outline" href={props.props.openOfficeHref}>
                                {props.props.openOfficeLabel}
                            </Button>
                            <Button
                                variant={props.props.newLeadIsPrimary ? "primary" : "outline"}
                                href={props.props.newLeadHref}
                            >
                                {props.props.newLeadLabel}
                            </Button>
                        </div>
                    }
                />
                <OverviewGovernance governance={props.props.governance} waiting={props.props.waiting} />
                <SectionHeader level={2} title={props.props.ownerBelowTitle} />
                <OverviewKpis label={props.props.kpiLabel} kpis={props.props.kpis} />
                <PrimaryRailLayout
                    railWidth="standard"
                    align="start"
                    primary={
                        <div className={MAIN_CLASS_NAME}>
                            <SectionHeader
                                level={2}
                                title={props.props.byOwnerTitle}
                                description={props.props.verifiedLabel}
                            />
                            <OwnerGroups
                                groups={props.props.groups}
                                emptyMessage={props.props.emptyMessage}
                                emptyDescription={props.props.emptyDescription}
                                emptyActionLabel={props.props.emptyActionLabel}
                                emptyHref={props.props.emptyHref}
                            />
                        </div>
                    }
                    rail={
                        <div className={RAIL_CLASS_NAME}>
                            <OnboardingChecklist steps={props.props.steps} />
                            <OverviewRail agents={props.props.agents} activity={props.props.activity} />
                        </div>
                    }
                />
                <FoundingOffer variant="hero" />
            </div>
        </div>
    </PageContainer>
)
