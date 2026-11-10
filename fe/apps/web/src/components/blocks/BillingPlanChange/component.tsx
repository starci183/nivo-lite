import { Button, Cluster, Stack, SurfaceCard, Tabs, Text } from "@starci/grammar/common"
import type { DescriptionListItem } from "@starci/grammar/common"
import { PlanCards } from "@/components/composites/PlanCards"
import type { PlanOfferCard } from "@/components/composites/PlanCards"

/** What the chosen change costs and gives, priced by the back end quote. */
export interface PlanChangeSummary {
    readonly title: string
    readonly facts: ReadonlyArray<DescriptionListItem>
    readonly payLabel: string
    readonly isPaying: boolean
}

/** Copy, plans and state the plan change supplies. */
export interface BillingPlanChangeBaseProps {
    readonly props: {
        readonly cycleLabel: string
        readonly cycle: "monthly" | "annual"
        readonly cycleMonthly: string
        readonly cycleAnnual: string
        readonly plans: ReadonlyArray<PlanOfferCard>
        readonly isLoading: boolean
        /** The plan picked but not paid yet. */
        readonly chosenId: string | null
        readonly summaryLabel: string
        readonly summary?: PlanChangeSummary | undefined
        readonly cancelLabel: string
        readonly note: string
    }
    readonly on: {
        readonly setCycle: (cycle: string) => void
        readonly choose: (planId: string) => void
        readonly pay: () => void
        readonly cancel: () => void
    }
}

/** The change card: what changes as term/value rows, then pay or cancel. */
/** What the change card reads: the page props and the priced change. */
type SummaryCardProps = BillingPlanChangeBaseProps & { readonly summary: PlanChangeSummary }

const SummaryCard = (props: SummaryCardProps) => (
    <SurfaceCard
        kind="details"
        label={`${props.props.summaryLabel} · ${props.summary.title}`}
        headingLevel={2}
        items={props.summary.facts}
        footers={[
            {
                kind: "custom",
                children: (
                    <Cluster gap="row" justify="end">
                        <Button intent="neutral" onPress={props.on.cancel}>
                            {props.props.cancelLabel}
                        </Button>
                        <Button intent="commit" isPending={props.summary.isPaying} onPress={props.on.pay}>
                            {props.summary.payLabel}
                        </Button>
                    </Cluster>
                ),
            },
        ]}
    />
)

/**
 * Draws the plan change: the billing cycle, the plans side by side as on the plan step (the one in use ringed and marked), and
 * once a plan is picked, what the change costs today and gives, with the payment it opens.
 */
export const BillingPlanChangeBase = (props: BillingPlanChangeBaseProps) => (
    <Stack gap="region">
        <Stack gap="row" align="center">
            <Tabs
                appearance="primary"
                label={props.props.cycleLabel}
                selectedKey={props.props.cycle}
                onSelect={props.on.setCycle}
                items={[
                    { id: "monthly", label: props.props.cycleMonthly },
                    { id: "annual", label: props.props.cycleAnnual },
                ]}
            />
        </Stack>
        <PlanCards cards={props.props.plans} pendingId={props.props.summary?.isPaying === true ? props.props.chosenId : null} onTake={props.on.choose} />
        {props.props.summary === undefined ? null : <SummaryCard {...props} summary={props.props.summary} />}
        <Text size="sm" tone="muted">
            {props.props.note}
        </Text>
    </Stack>
)
