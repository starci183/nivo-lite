import {
    Alert,
    Badge,
    Button,
    NumberField,
    SectionHeader,
    SegmentedControl,
    Select,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import {
    BADGES_CLASS_NAME,
    CARD_CLASS_NAME,
    CATALOG_CLASS_NAME,
    FACTS_CLASS_NAME,
    GRID_CLASS_NAME,
    GROUP_CLASS_NAME,
    PRICE_CLASS_NAME,
} from "./classNames"

/** One plan as the catalogue draws it: settled copy and prices, never a computation. */
export interface PlanCardView {
    readonly id: string
    readonly name: string
    readonly isCurrent: boolean
    readonly price: string
    readonly isPriceLoading: boolean
    readonly badges: ReadonlyArray<{ readonly label: string; readonly tone: "success" | "accent" | "neutral" }>
    readonly notes: ReadonlyArray<string>
    readonly facts: ReadonlyArray<string>
    readonly tier?:
        | {
              readonly label: string
              readonly value: string
              readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>
          }
        | undefined
    readonly seats?: { readonly label: string; readonly value: number; readonly max: number } | undefined
    readonly action: {
        readonly kind: "checkout" | "contact"
        readonly label: string
        readonly href: string
        readonly isPending: boolean
        readonly isDisabled: boolean
    }
}

/** An audience group of plans with its header. */
export interface PlanGroupView {
    readonly id: string
    readonly title: string
    readonly text: string
    readonly cards: ReadonlyArray<PlanCardView>
}

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

/** Draws the plans: the billing cycle toggle, then Individual, Team and Enterprise with their usage tiers, seats and actions. */
export const PlanCatalog = (props: PlanCatalogProps) => {
    const view = props.props
    return (
        <div className={CATALOG_CLASS_NAME}>
            <SectionHeader level={2} title={view.title} description={view.text} />
            {view.notice ? <Alert tone="informative" title={view.notice} /> : null}
            {view.storage ? (
                <Text size="sm" tone="muted">
                    {view.storage}
                </Text>
            ) : null}
            <SegmentedControl
                label={view.cycleLabel}
                options={view.cycleOptions}
                value={view.cycle}
                onValueChange={props.on.setCycle}
            />
            {view.groups.map((group) => (
                <div key={group.id} className={GROUP_CLASS_NAME}>
                    <SectionHeader level={3} title={group.title} description={group.text} />
                    <div className={GRID_CLASS_NAME}>
                        {group.cards.map((card) => (
                            <SurfaceCard key={card.id} label={card.name} headingLevel={4} isHighlight={card.isCurrent}>
                                <div className={CARD_CLASS_NAME}>
                                    {renderPlanCatalogPrice(card)}
                                    {card.badges.length > 0 ? (
                                        <div className={BADGES_CLASS_NAME}>
                                            {card.badges.map((badge) => (
                                                <Badge key={badge.label} tone={badge.tone}>
                                                    {badge.label}
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : null}
                                    {card.tier ? (
                                        <Select
                                            label={card.tier.label}
                                            variant="secondary"
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
                                            variant="secondary"
                                            value={card.seats.value}
                                            minValue={1}
                                            maxValue={card.seats.max}
                                            step={1}
                                            onValueChange={props.on.setSeats}
                                        />
                                    ) : null}
                                    <div className={FACTS_CLASS_NAME}>
                                        {card.facts.map((fact) => (
                                            <Text key={fact} size="sm">
                                                {fact}
                                            </Text>
                                        ))}
                                    </div>
                                    {card.action.kind === "contact"
                                        ? renderPlanCatalogContactAction(card)
                                        : renderPlanCatalogCheckoutAction(card, props)}
                                </div>
                            </SurfaceCard>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

/** Renders the PlanCatalog price section. */
const renderPlanCatalogPrice = (card: Pick<PlanCardView, "isPriceLoading" | "price" | "notes">) => (
    <div className={PRICE_CLASS_NAME}>
        <Text size="metric-lead" weight="semibold" isSkeleton={card.isPriceLoading}>
            {card.price}
        </Text>
        {card.notes.map((note) => (
            <Text key={note} size="sm" tone="muted">
                {note}
            </Text>
        ))}
    </div>
)

/** Renders the PlanCatalog contact action section. */
const renderPlanCatalogContactAction = (card: Pick<PlanCardView, "action">) => (
    <div>
        <Button variant="secondary" href={card.action.href} target="_blank" rel="noopener noreferrer">
            {card.action.label}
        </Button>
    </div>
)

/** Renders the PlanCatalog checkout action section. */
const renderPlanCatalogCheckoutAction = (card: Pick<PlanCardView, "action" | "id">, props: PlanCatalogProps) => (
    <div>
        <Button
            variant="primary"
            isPending={card.action.isPending}
            isDisabled={card.action.isDisabled}
            onPress={() => props.on.choose(card.id)}
        >
            {card.action.label}
        </Button>
    </div>
)
