import type { ComponentProps } from "react"
import { Badge, Cluster, DescriptionList, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { BillingHistoryList, type BillingHistoryRow } from "@/components/composites/BillingHistoryList"
import { BillingRenewal } from "@/components/composites/BillingRenewal"
import { SlotView } from "@/components/composites/SlotView"
import { UsageCard } from "@/components/composites/UsageCard"
import type { BillingPlanView, DataSlot, SlotLabels } from "@/modules/types"

/** What the usage card takes, read from the card itself. */
type UsageCardProps = ComponentProps<typeof UsageCard>

/** Settled billing copy, region slots and feature interactions. */
export interface BillingOverviewBaseProps {
    readonly props: {
        /** The renewal order is being requested: the renew button is pending. */
        readonly isRenewing: boolean
        readonly planLabel: string
        readonly statusLabel: string
        readonly paidUntilLabel: string
        readonly renewalLabel: string
        readonly renewalHint: string
        readonly plan: DataSlot<BillingPlanView>
        readonly planSlotLabels: SlotLabels
        readonly usage: DataSlot<UsageCardProps["view"]>
        readonly usagePlaceholder: UsageCardProps["view"]
        readonly usageSlotLabels: SlotLabels
        readonly historyTitle: string
        readonly historyEmpty: string
        readonly orders: DataSlot<ReadonlyArray<BillingHistoryRow>>
        readonly ordersSlotLabels: SlotLabels
        readonly reviewTitle: string
        readonly reviewDescription: string
        readonly reviewEmpty: string
        readonly review: DataSlot<ReadonlyArray<BillingHistoryRow>>
        readonly reviewSlotLabels: SlotLabels
    }
    readonly on: {
        readonly renew: () => void
        readonly retryPlan: () => void
        readonly retryOrders: () => void
        readonly retryReview: () => void
        readonly retryUsage: () => void
        readonly openCredits: () => void
        readonly formatUsageDay: (value: unknown) => string
        readonly formatUsageCredits: (value: unknown) => string
        readonly minimumUsageBarSize: (value: number | null | undefined) => number
    }
}

/** What the plan card draws while its read is in flight. */
const PLAN_PLACEHOLDER: BillingPlanView = {
    planName: "…",
    status: "…",
    statusTone: "neutral",
    paidUntil: "…",
    canRenew: false,
}

/** What a history region draws while its read is in flight. */
const ROWS_PLACEHOLDER: ReadonlyArray<BillingHistoryRow> = [
    { id: "placeholder-1", title: "…", detail: "…" },
    { id: "placeholder-2", title: "…", detail: "…" },
]

/** Draws the billing regions (plan, usage, history, review) from settled display values, region slots and interactions. */
export const BillingOverviewBase = (props: BillingOverviewBaseProps) => (
    <Stack gap="region">
        <SlotView
            slot={props.props.plan}
            placeholder={PLAN_PLACEHOLDER}
            labels={props.props.planSlotLabels}
            forbidden="notice"
            onRetry={props.on.retryPlan}
        >
            {(plan) => renderCurrentBillingPlan(props, plan)}
        </SlotView>
        <SlotView
            slot={props.props.usage}
            placeholder={props.props.usagePlaceholder}
            labels={props.props.usageSlotLabels}
            forbidden="hide"
            onRetry={props.on.retryUsage}
        >
            {(view, isSkeleton) => (
                <UsageCard
                    view={view}
                    isSkeleton={isSkeleton}
                    on={{
                        retry: props.on.retryUsage,
                        openCredits: props.on.openCredits,
                        formatDay: props.on.formatUsageDay,
                        formatCredits: props.on.formatUsageCredits,
                        minimumBarSize: props.on.minimumUsageBarSize,
                    }}
                />
            )}
        </SlotView>
        <SlotView
            slot={props.props.orders}
            placeholder={ROWS_PLACEHOLDER}
            labels={props.props.ordersSlotLabels}
            forbidden="hide"
            onRetry={props.on.retryOrders}
        >
            {(orders) => (
                <BillingHistoryList
                    props={{ title: props.props.historyTitle, empty: props.props.historyEmpty, rows: orders }}
                />
            )}
        </SlotView>
        <SlotView
            slot={props.props.review}
            placeholder={ROWS_PLACEHOLDER}
            labels={props.props.reviewSlotLabels}
            forbidden="hide"
            onRetry={props.on.retryReview}
        >
            {(review) => (
                <BillingHistoryList
                    props={{
                        title: props.props.reviewTitle,
                        description: props.props.reviewDescription,
                        empty: props.props.reviewEmpty,
                        rows: review,
                    }}
                />
            )}
        </SlotView>
    </Stack>
)

/** Draws the SurfaceCard section of the BillingOverview view. */
const renderCurrentBillingPlan = (props: BillingOverviewBaseProps, plan: BillingPlanView) => (
    <SurfaceCard label={props.props.planLabel} headingLevel={2}>
        <Stack gap="section">
            <DescriptionList
                layout="columns"
                isDivided
                items={[
                    {
                        id: "plan",
                        term: props.props.planLabel,
                        description: <Text weight="semibold">{plan.planName}</Text>,
                    },
                    {
                        id: "status",
                        term: props.props.statusLabel,
                        description: (
                            <Badge tone={plan.statusTone} isDot>
                                {plan.status}
                            </Badge>
                        ),
                    },
                    {
                        id: "paidUntil",
                        term: props.props.paidUntilLabel,
                        description: <Text weight="semibold">{plan.paidUntil}</Text>,
                    },
                ]}
            />
            {plan.canRenew ? (
                <Cluster gap="row">
                    <BillingRenewal
                        props={{ label: props.props.renewalLabel, isPending: props.props.isRenewing }}
                        on={{ renew: props.on.renew }}
                    />
                    <Text size="sm" tone="muted">
                        {props.props.renewalHint}
                    </Text>
                </Cluster>
            ) : null}
        </Stack>
    </SurfaceCard>
)
