import {
    Alert,
    Badge,
    Button,
    DescriptionList,
    PageContainer,
    Region,
    SectionHeader,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import { BillingHistoryList } from "@/components/composites/BillingHistoryList"
import type { BillingHistoryRow } from "@/components/composites/BillingHistoryList"
import { BillingRenewal } from "@/components/composites/BillingRenewal"
import { UsageCard } from "@/components/composites/UsageCard"
import type { UsageCardView } from "@/hooks/usageCard"
import { ACTIONS_CLASS_NAME, PAGE_CLASS_NAME, SECTION_CLASS_NAME, STACK_CLASS_NAME } from "./classNames"

type BillingTone = "success" | "warning" | "danger" | "neutral"

/** Settled billing copy, display values and feature interactions. */
export interface BillingOverviewBaseProps {
    readonly state: {
        readonly phase: "loading" | "error" | "ready"
        readonly canRenew: boolean
        readonly isRenewing: boolean
        readonly usage: UsageCardView["state"]
    }
    readonly props: {
        readonly title: string
        readonly description: string
        readonly backLabel: string
        readonly backHref: string
        readonly loading: string
        readonly errorTitle: string
        readonly errorDescription: string
        readonly planLabel: string
        readonly planName: string
        readonly statusLabel: string
        readonly status: string
        readonly statusTone: BillingTone
        readonly paidUntilLabel: string
        readonly paidUntil: string
        readonly renewalLabel: string
        readonly renewalHint: string
        readonly usage: UsageCardView["props"]
        readonly historyTitle: string
        readonly historyEmpty: string
        readonly orders: ReadonlyArray<BillingHistoryRow>
        readonly reviewTitle: string
        readonly reviewDescription: string
        readonly reviewEmpty: string
        readonly review: ReadonlyArray<BillingHistoryRow>
    }
    readonly on: {
        readonly renew: () => void
        readonly openCredits: () => void
        readonly formatUsageDay: (value: unknown) => string
        readonly formatUsageCredits: (value: unknown) => string
        readonly minimumUsageBarSize: (value: number | null | undefined) => number
    }
}

/** Draws billing from settled display values and interactions. */
export const BillingOverviewBase = (props: BillingOverviewBaseProps) => {
    if (props.state.phase === "error")
        return (
            <PageContainer measure="product">
                <Alert tone="negative" title={props.props.errorTitle} description={props.props.errorDescription} />
            </PageContainer>
        )
    if (props.state.phase === "loading")
        return (
            <PageContainer measure="product">
                <SectionHeader level={1} title={props.props.title} />
                <Text tone="muted">{props.props.loading}</Text>
            </PageContainer>
        )
    return (
        <PageContainer measure="product">
            <div className={PAGE_CLASS_NAME}>
                <div>
                    <Button variant="outline" size="sm" href={props.props.backHref}>
                        {props.props.backLabel}
                    </Button>
                </div>
                <SectionHeader level={1} title={props.props.title} description={props.props.description} />
                <SurfaceCard label={props.props.planLabel} headingLevel={2}>
                    <div className={STACK_CLASS_NAME}>
                        <DescriptionList
                            layout="columns"
                            isDivided
                            items={[
                                {
                                    id: "plan",
                                    term: props.props.planLabel,
                                    description: <Text weight="semibold">{props.props.planName}</Text>,
                                },
                                {
                                    id: "status",
                                    term: props.props.statusLabel,
                                    description: (
                                        <Badge tone={props.props.statusTone} isDot>
                                            {props.props.status}
                                        </Badge>
                                    ),
                                },
                                {
                                    id: "paidUntil",
                                    term: props.props.paidUntilLabel,
                                    description: <Text weight="semibold">{props.props.paidUntil}</Text>,
                                },
                            ]}
                        />
                        {props.state.canRenew ? (
                            <div className={ACTIONS_CLASS_NAME}>
                                <BillingRenewal
                                    state={{ isRequesting: props.state.isRenewing }}
                                    props={{ label: props.props.renewalLabel }}
                                    on={{ renew: props.on.renew }}
                                />
                                <Text size="sm" tone="muted">
                                    {props.props.renewalHint}
                                </Text>
                            </div>
                        ) : null}
                    </div>
                </SurfaceCard>
                <UsageCard
                    state={props.state.usage}
                    props={props.props.usage}
                    on={{
                        openCredits: props.on.openCredits,
                        formatDay: props.on.formatUsageDay,
                        formatCredits: props.on.formatUsageCredits,
                        minimumBarSize: props.on.minimumUsageBarSize,
                    }}
                />
                <BillingHistoryList
                    props={{
                        title: props.props.historyTitle,
                        empty: props.props.historyEmpty,
                        rows: props.props.orders,
                    }}
                />
                <Region labelledBy="billing-review-title" className={SECTION_CLASS_NAME}>
                    <SectionHeader
                        id="billing-review-title"
                        level={2}
                        title={props.props.reviewTitle}
                        description={props.props.reviewDescription}
                    />
                    <BillingHistoryList
                        props={{
                            ariaLabel: props.props.reviewTitle,
                            empty: props.props.reviewEmpty,
                            rows: props.props.review,
                        }}
                    />
                </Region>
            </div>
        </PageContainer>
    )
}
