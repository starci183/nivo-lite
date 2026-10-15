import {
    Badge,
    Button,
    DescriptionList,
    PageContainer,
    Region,
    SectionHeader,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import { LandingFact } from "@/components/composites/LandingFact"
import type { IconGlyphName } from "@/components/leaves/Icon"
import { ANCHOR, BENTO, FACTS_COL, PRICE_ROW, PRICE_STACK, SECTION_STACK, TILE_BODY, TILE_FOOT } from "./classNames"

/** One scope fact beside the price card. */
interface LandingOfferFact {
    readonly id: string
    readonly icon: IconGlyphName
    readonly title: string
    readonly text: string
}

/** One unit of the countdown. */
interface LandingOfferCountdownUnit {
    readonly id: string
    readonly term: string
    readonly value: string
}

/** The campaign part of the price card, present only while the Founding offer is live. */
interface LandingOfferCampaign {
    readonly tag: string
    readonly basePrice: string
    readonly saving: string
    readonly endsText: string
    readonly countdownLabel: string
    /** The four units left until the offer ends: term and two-digit value each. */
    readonly countdown: ReadonlyArray<LandingOfferCountdownUnit>
}

/** The resolved words the offer section draws. */
interface LandingOfferBaseProps {
    readonly props: {
        readonly regionLabel: string
        readonly eyebrow: string
        readonly title: string
        readonly leftFacts: ReadonlyArray<LandingOfferFact>
        readonly rightFacts: ReadonlyArray<LandingOfferFact>
        readonly priceLabel: string
        readonly planName: string
        readonly price: string
        readonly perMonth: string
        readonly priceNote: string
        readonly campaign: LandingOfferCampaign | null
        readonly ctaLabel: string
        readonly ctaHref: string
        readonly fine: string
    }
}

/**
 * The "clear scope" facts plus the price card merged with the Founding campaign. The price card is the section's one
 * featured card; its price is the region's lead figure with the unit set lighter beside it.
 */
export const LandingOfferBase = (props: LandingOfferBaseProps) => {
    const campaign = props.props.campaign
    return (
        <Region id="founding" label={props.props.regionLabel} className={ANCHOR}>
            <PageContainer measure="product">
                <div className={SECTION_STACK}>
                    <SectionHeader eyebrow={props.props.eyebrow} title={props.props.title} />
                    <div className={BENTO}>
                        <div className={FACTS_COL}>
                            {props.props.leftFacts.map((fact) => (
                                <LandingFact key={fact.id} icon={fact.icon} title={fact.title} text={fact.text} />
                            ))}
                        </div>
                        <SurfaceCard
                            label={props.props.priceLabel}
                            headingLevel={3}
                            labelEnd={campaign === null ? undefined : <Badge tone="accent">{campaign.tag}</Badge>}
                            isHighlight
                            height="fill"
                        >
                            <div className={TILE_BODY}>
                                <div className={PRICE_STACK}>
                                    <Text size="sm" tone="muted" weight="medium">
                                        {props.props.planName}
                                    </Text>
                                    {campaign === null ? null : (
                                        <Text tone="muted" isSuperseded>
                                            {campaign.basePrice}
                                        </Text>
                                    )}
                                    <div className={PRICE_ROW}>
                                        <Text size="metric-lead" weight="semibold">
                                            {props.props.price}
                                        </Text>
                                        <Text size="sm" tone="muted">
                                            {props.props.perMonth}
                                        </Text>
                                    </div>
                                    <Text size="sm" tone="muted">
                                        {props.props.priceNote}
                                    </Text>
                                    {campaign === null ? null : (
                                        <Text tone="accent" weight="semibold">
                                            {campaign.saving}
                                        </Text>
                                    )}
                                </div>
                                <div className={TILE_FOOT}>
                                    {campaign === null ? null : (
                                        <>
                                            <div role="timer" aria-label={campaign.countdownLabel}>
                                                <DescriptionList
                                                    layout="stat-strip"
                                                    isDivided
                                                    items={campaign.countdown.map((unit) => ({
                                                        id: unit.id,
                                                        term: unit.term,
                                                        description: unit.value,
                                                    }))}
                                                />
                                            </div>
                                            <Text size="xs">{campaign.endsText}</Text>
                                        </>
                                    )}
                                    <Button variant="primary" size="lg" width="fill" href={props.props.ctaHref}>
                                        {props.props.ctaLabel}
                                    </Button>
                                    <Text size="xs">{props.props.fine}</Text>
                                </div>
                            </div>
                        </SurfaceCard>
                        <div className={FACTS_COL}>
                            {props.props.rightFacts.map((fact) => (
                                <LandingFact key={fact.id} icon={fact.icon} title={fact.title} text={fact.text} />
                            ))}
                        </div>
                    </div>
                </div>
            </PageContainer>
        </Region>
    )
}
