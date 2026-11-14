import { Badge, Button, Cluster, Grid, Heading, Icon, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"

/** One plan as a card: its name, price, the way to take it and what it includes. */
export interface PlanOfferCard {
    readonly id: string
    readonly name: string
    readonly price: string
    /** The card a set of plans singles out (the popular one, or the one in use): the accent ring and a badge. */
    readonly mark?: string | undefined
    readonly features: ReadonlyArray<string>
    readonly action:
        | { readonly kind: "buy"; readonly label: string; readonly isPrimary: boolean }
        | { readonly kind: "contact"; readonly label: string; readonly href: string }
        | { readonly kind: "current"; readonly label: string }
}

/** The plans, the one being taken and what taking one does. */
interface PlanCardsProps {
    readonly cards: ReadonlyArray<PlanOfferCard>
    /** The plan whose request is in flight: its button is pending, the others wait. */
    readonly pendingId: string | null
    readonly onTake: (planId: string) => void
}

/** What one plan card reads. */
interface PlanCardProps {
    readonly card: PlanOfferCard
    readonly pendingId: string | null
    readonly onTake: (planId: string) => void
}

/** The card's one command: take the plan, ask for a contract, or the plan already in use. */
const PlanAction = (props: PlanCardProps) => {
    const action = props.card.action
    if (action.kind === "contact") {
        return (
            <Button intent="neutral" width="fill" href={action.href} target="_blank" rel="noopener noreferrer">
                {action.label}
            </Button>
        )
    }
    if (action.kind === "current") {
        return (
            <Button intent="neutral" width="fill" isDisabled>
                {action.label}
            </Button>
        )
    }
    return (
        <Button
            intent={action.isPrimary ? "commit" : "neutral"}
            width="fill"
            isPending={props.pendingId === props.card.id}
            isDisabled={props.pendingId !== null}
            onPress={() => props.onTake(props.card.id)}
        >
            {action.label}
        </Button>
    )
}

/** One plan as a card: name and price with its command in the header zone, what it includes in the body. */
const PlanCard = (props: PlanCardProps) => {
    const card = props.card
    const head = (
        <Stack gap="row">
            <Cluster gap="inline" justify="between">
                <Heading level={2}>{card.name}</Heading>
                {card.mark === undefined ? null : <Badge tone="accent">{card.mark}</Badge>}
            </Cluster>
            <Text size="figure">{card.price}</Text>
            <PlanAction {...props} />
        </Stack>
    )
    return (
        <SurfaceCard
            ariaLabel={card.name}
            {...(card.mark === undefined ? {} : { emphasis: "accent" as const })}
            headers={[{ kind: "custom", children: head }]}
        >
            <Stack gap="row">
                {card.features.map((feature) => (
                    <Text key={feature} size="sm" startContent={<Icon source={nivoIconSource("complete", "leading")} usage="leading" />}>
                        {feature}
                    </Text>
                ))}
            </Stack>
        </SurfaceCard>
    )
}

/** Four plans stand in one row; five or more wrap three to a row, so no single card is left alone on the last row. */
const columnsOf = (count: number): 2 | 3 | 4 => {
    if (count === 4) return 4
    return count > 4 || count === 3 ? 3 : 2
}

/** The plans side by side as cards, the same in the plan step and in the plan change: one ringed card, one command each. */
export const PlanCards = (props: PlanCardsProps) => (
    <Grid kind="cards" columns={columnsOf(props.cards.length)}>
        {props.cards.map((card) => (
            <PlanCard key={card.id} card={card} pendingId={props.pendingId} onTake={props.onTake} />
        ))}
    </Grid>
)
