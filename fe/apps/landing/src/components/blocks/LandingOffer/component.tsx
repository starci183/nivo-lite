import { Badge, Button, DescriptionList, Grid, Stack, SurfaceCard, Text, Section } from "@starci/grammar/common"
import { LandingFact } from "@/components/composites/LandingFact"
import type { IconGlyphName } from "@/components/leaves/Icon"
import { ANCHOR } from "./classNames"

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
        <div id="founding" className={ANCHOR}>
            <Section title={props.props.title} description={props.props.eyebrow}>
                <Grid
                    kind="featured"
                    leading={
                        <Stack gap="section">
                            {props.props.leftFacts.map((fact) => (
                                <LandingFact key={fact.id} icon={fact.icon} title={fact.title} text={fact.text} />
                            ))}
                        </Stack>
                    }
                    featured={renderLandingOfferPrice(props, campaign)}
                    trailing={
                        <Stack gap="section">
                            {props.props.rightFacts.map((fact) => (
                                <LandingFact key={fact.id} icon={fact.icon} title={fact.title} text={fact.text} />
                            ))}
                        </Stack>
                    }
                />
            </Section>
        </div>
    )
}

/** Renders the LandingOffer price section. */
const renderLandingOfferPrice = (
    props: Pick<LandingOfferBaseProps, "props">,
    campaign: LandingOfferBaseProps["props"]["campaign"],
) => (
    <SurfaceCard
        label={props.props.priceLabel}
        headingLevel={3}
        labelEnd={campaign === null ? undefined : <Badge tone="accent">{campaign.tag}</Badge>}
        isHighlight
        height="fill"
        headers={[
            {
                kind: "figures",
                items: [
                    {
                        id: "price",
                        term: props.props.planName,
                        value: props.props.price,
                        unit: props.props.perMonth,
                        meta: props.props.priceNote,
                    },
                ],
            },
        ]}
    >
        <Stack gap="row">
            {campaign === null ? null : (
                <Stack gap="identity">
                    <Text size="sm" tone="muted" isSuperseded>
                        {campaign.basePrice}
                    </Text>
                    <Text isStrong>{campaign.saving}</Text>
                </Stack>
            )}
            {campaign === null ? null : (
                <>
                    <div role="timer" aria-label={campaign.countdownLabel}>
                        <DescriptionList
                            layout="columns"
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
            <Button intent="commit" size="lg" width="fill" href={props.props.ctaHref}>
                {props.props.ctaLabel}
            </Button>
            <Text size="xs">{props.props.fine}</Text>
        </Stack>
    </SurfaceCard>
)
