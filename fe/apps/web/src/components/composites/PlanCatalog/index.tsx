import {
    Alert,
    Badge,
    Button,
    NumberField,
    Cluster,
    EmptyNotice,
    Section,
    Stack,
    ChoiceChips,
    Select,
    Text,
} from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import type { PlanCardView, PlanGroupView } from "@/modules/types"

interface PlanCatalogProps {
    readonly props: {
        readonly title: string
        readonly text: string
        readonly cycleLabel: string
        readonly cycle: string
        readonly cycleOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly notice?: string | undefined
        readonly storage?: string | undefined
        readonly groups: ReadonlyArray<PlanGroupView>
    }
    readonly on: {
        readonly setCycle: (value: string) => void
        readonly setTier: (planId: string, value: string) => void
        readonly setSeats: (value: number) => void
        readonly choose: (planId: string) => void
    }
}

/** Plans are equal comparison rows; the billing-cycle field and every purchase control keep their behavior. */
export const PlanCatalog = (props: PlanCatalogProps) => {
    const view = props.props
    return (
        <Section title={view.title} description={view.text}>
            {view.notice ? <Alert tone="informative" title={view.notice} /> : null}
            {view.storage ? (
                <Text size="sm" tone="muted">
                    {view.storage}
                </Text>
            ) : null}
            <ChoiceChips
                label={view.cycleLabel}
                empty={view.cycleLabel}
                options={view.cycleOptions}
                value={view.cycle}
                onValueChange={props.on.setCycle}
            />
            {view.groups.map((group) => (
                <Section
                    key={group.id}
                    kind="list"
                    title={group.title}
                    description={group.text}
                    headingLevel={3}
                    items={group.cards.map((card) => planItemOf(card, props))}
                    empty={<EmptyNotice message={group.title} />}
                />
            ))}
        </Section>
    )
}

/** Price, current-plan badges, seats, tier and entitlements stay together under the plan's row. */
const planItemOf = (card: PlanCardView, props: PlanCatalogProps): ListRowData => ({
    id: card.id,
    title: card.name,
    detail: (
        <Stack gap="row">
            <Stack gap="identity">
                <Text isStrong isLoading={card.isPriceLoading}>
                    {card.price}
                </Text>
                {card.notes.map((note) => (
                    <Text key={note} size="sm" tone="muted">
                        {note}
                    </Text>
                ))}
            </Stack>
            {card.badges.length === 0 ? null : (
                <Cluster gap="inline">
                    {card.badges.map((badge) => (
                        <Badge key={badge.label} tone={badge.tone}>
                            {badge.label}
                        </Badge>
                    ))}
                </Cluster>
            )}
            {card.tier ? (
                <Select
                    label={card.tier.label}
                    options={card.tier.options}
                    value={card.tier.value}
                    onValueChange={(value) => {
                        if (value !== null) props.on.setTier(card.id, value)
                    }}
                />
            ) : null}
            {card.seats ? (
                <NumberField
                    label={card.seats.label}
                    value={card.seats.value}
                    minValue={1}
                    maxValue={card.seats.max}
                    step={1}
                    onValueChange={props.on.setSeats}
                />
            ) : null}
            <Stack gap="identity">
                {card.facts.map((fact) => (
                    <Text key={fact} size="sm">
                        {fact}
                    </Text>
                ))}
            </Stack>
            {card.action.kind === "contact" ? (
                <Button intent="neutral" href={card.action.href} target="_blank" rel="noopener noreferrer">
                    {card.action.label}
                </Button>
            ) : (
                <Button
                    intent="neutral"
                    isPending={card.action.isPending}
                    isDisabled={card.action.isDisabled}
                    onPress={() => props.on.choose(card.id)}
                >
                    {card.action.label}
                </Button>
            )}
        </Stack>
    ),
})
