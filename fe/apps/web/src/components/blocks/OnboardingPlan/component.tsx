import {
    Button,
    Cluster,
    Heading,
    Stack,
    SurfaceCard,
    Tabs,
    Text,
} from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import { PlanCards, type PlanOfferCard } from "@/components/composites/PlanCards"

/** Copy, plans and state the plan step supplies. */
export interface OnboardingPlanBaseProps {
    readonly props: {
        readonly heading: string
        readonly description: string
        readonly cycleLabel: string
        readonly cycle: "monthly" | "annual"
        readonly cycleMonthly: string
        readonly cycleAnnual: string
        readonly plans: ReadonlyArray<PlanOfferCard>
        readonly isLoading: boolean
        readonly pendingId: string | null
        readonly free: {
            readonly title: string
            readonly text: string
            readonly label: string
            readonly href: string
        }
        readonly backLabel: string
        readonly backHref: string
        readonly note: string
    }
    readonly on: { readonly setCycle: (cycle: string) => void; readonly buy: (planId: string) => void }
}

/** Draws the plan step as a pricing page: the head with the billing-cycle switch, the plans side by side, the free trial and the way back. */
export const OnboardingPlanBase = (props: OnboardingPlanBaseProps) => {
    const view = props.props
    return (
        <Stack gap="region">
            <Stack gap="row" align="center">
                <Heading level={1} scale="title" isLoading={view.isLoading}>
                    {view.heading}
                </Heading>
                <Text tone="muted">{view.description}</Text>
                <Tabs
                    appearance="primary"
                    label={view.cycleLabel}
                    selectedKey={view.cycle}
                    onSelect={props.on.setCycle}
                    items={[
                        { id: "monthly", label: view.cycleMonthly },
                        { id: "annual", label: view.cycleAnnual },
                    ]}
                />
            </Stack>
            <PlanCards cards={view.plans} pendingId={view.pendingId} onTake={props.on.buy} />
            <SurfaceCard
                kind="list"
                ariaLabel={view.free.title}
                items={[
                    {
                        id: "free",
                        title: view.free.title,
                        description: view.free.text,
                        leading: { icon: nivoIconSource("reward", "leading") },
                        action: { label: view.free.label, intent: "neutral", href: view.free.href },
                    },
                ]}
                empty={null}
            />
            <Cluster gap="row" justify="between">
                <Button intent="neutral" href={view.backHref}>
                    {view.backLabel}
                </Button>
                <Text tone="muted" size="sm">
                    {view.note}
                </Text>
            </Cluster>
        </Stack>
    )
}
