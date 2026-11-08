import {
    Badge,
    Button,
    Cluster,
    Grid,
    Heading,
    Icon,
    Mascot,
    Stack,
    SurfaceCard,
    Tabs,
    Text,
} from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"

/** One plan card: its name, price, the way to take it and what it includes. */
export interface OnboardingPlanCard {
    readonly id: string
    readonly name: string
    readonly price: string
    /** The plan the step recommends: the accent ring, a badge and the commit button. */
    readonly isPopular: boolean
    readonly features: ReadonlyArray<string>
    readonly action:
        | { readonly kind: "buy"; readonly label: string }
        | { readonly kind: "contact"; readonly label: string; readonly href: string }
}

/** Copy, plans and state the plan step supplies. */
export interface OnboardingPlanBaseProps {
    readonly props: {
        readonly heading: string
        readonly description: string
        readonly cycleLabel: string
        readonly cycle: "monthly" | "annual"
        readonly cycleMonthly: string
        readonly cycleAnnual: string
        readonly popularLabel: string
        readonly plans: ReadonlyArray<OnboardingPlanCard>
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

/** What one plan card reads: the card and the step it belongs to. */
interface PlanCardProps {
    readonly card: OnboardingPlanCard
    readonly base: OnboardingPlanBaseProps
}

/** One plan as a card: name and price with its action in the header zone, what it includes in the body. */
const PlanCard = (props: PlanCardProps) => {
    const { card, base } = props
    const action =
        card.action.kind === "contact" ? (
            <Button intent="neutral" width="fill" href={card.action.href} target="_blank" rel="noopener noreferrer">
                {card.action.label}
            </Button>
        ) : (
            <Button
                intent={card.isPopular ? "commit" : "neutral"}
                width="fill"
                isPending={base.props.pendingId === card.id}
                isDisabled={base.props.pendingId !== null}
                onPress={() => base.on.buy(card.id)}
            >
                {card.action.label}
            </Button>
        )
    const head = (
        <Stack gap="row">
            <Cluster gap="inline" justify="between">
                <Heading level={2}>{card.name}</Heading>
                {card.isPopular ? <Badge tone="accent">{base.props.popularLabel}</Badge> : null}
            </Cluster>
            <Text size="figure">{card.price}</Text>
            {action}
        </Stack>
    )
    const body = (
        <Stack gap="row">
            {card.features.map((feature) => (
                <Text
                    key={feature}
                    size="sm"
                    startContent={<Icon source={nivoIconSource("complete", "leading")} usage="leading" />}
                >
                    {feature}
                </Text>
            ))}
        </Stack>
    )
    return (
        <SurfaceCard
            ariaLabel={card.name}
            {...(card.isPopular ? { emphasis: "accent" as const } : {})}
            headers={[{ kind: "custom", children: head }]}
        >
            {body}
        </SurfaceCard>
    )
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
            <Grid kind="cards" columns={4}>
                {view.plans.map((card) => (
                    <PlanCard key={card.id} card={card} base={props} />
                ))}
            </Grid>
            <SurfaceCard ariaLabel={view.free.title}>
                <Cluster gap="section" justify="between">
                    <Cluster gap="row" wrap={false}>
                        <Mascot
                            src="/images/entry/lobby-welcome-3d.webp"
                            size="sm"
                            loading="eager"
                            assetSlot="onboarding-plan-free"
                            assetSha256="d5449ae1a2ec4b93ace1d36b2e039943d9b38bf4f36536bd93f240fd3259af2f"
                            assetPrompt="A golden pure 3D key with a heart-shaped bow and small sparkles, soft clay render, no characters, transparent ground"
                        />
                        <Stack gap="identity">
                            <Text isStrong>{view.free.title}</Text>
                            <Text tone="muted" size="sm">
                                {view.free.text}
                            </Text>
                        </Stack>
                    </Cluster>
                    <Button intent="neutral" href={view.free.href}>
                        {view.free.label}
                    </Button>
                </Cluster>
            </SurfaceCard>
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
