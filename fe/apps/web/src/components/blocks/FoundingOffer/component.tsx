import {
    Alert,
    Badge,
    Button,
    DescriptionList,
    Image,
    Meter,
    Region,
    SectionHeader,
    SurfaceCard,
    Text,
    TextAction,
} from "@starci/grammar/common"
import { HERO_COPY, HERO_COUNTDOWN, HERO_ROW, PILL_WRAP, STRIP } from "./classNames"

/** One countdown unit: its word and the two-digit figure (or a dash before the first tick). */
export type FoundingOfferUnit = { readonly id: string; readonly term: string; readonly value: string }

/** Every sentence of the campaign, resolved by the connected block. */
export interface FoundingOfferBaseProps {
    readonly state: "hero" | "strip" | "inline" | "pill"
    readonly props: {
        readonly name: string
        readonly ctaHref: string
        readonly cta: string
        readonly offerAria: string
        readonly pillText: string
        readonly stripTitle: string
        readonly stripEnds: string
        readonly dismissLabel: string
        readonly inlineTitle: string
        readonly inlineText: string
        readonly heroEyebrow: string
        readonly heroTitle: string
        readonly subline: string
        readonly caption: string
        readonly conditions: string
        readonly countdownAria: string
        readonly units: ReadonlyArray<FoundingOfferUnit>
        readonly slots: { readonly claimed: number; readonly cap: number; readonly label: string } | null
    }
    readonly on: { readonly dismiss: () => void }
}

type PartProps = Pick<FoundingOfferBaseProps, "props" | "on">

const Pill = ({ props }: PartProps) => (
    <div className={PILL_WRAP} role="note" aria-label={props.offerAria}>
        <Badge tone="accent">{props.name}</Badge>
        <Text size="sm" tone="muted">
            {props.pillText}
        </Text>
    </div>
)

const Strip = ({ props, on }: PartProps) => (
    <Region className={STRIP} label={props.offerAria}>
        <Alert
            tone="informative"
            title={props.stripTitle}
            description={
                <>
                    {props.stripEnds}{" "}
                    {/* A destination, so a TextAction with href rather than the Alert command action. */}
                    <TextAction href={props.ctaHref} appearance="inline">
                        {props.cta}
                    </TextAction>
                </>
            }
            dismissLabel={props.dismissLabel}
            onDismiss={on.dismiss}
        />
    </Region>
)

const Hero = ({ props }: PartProps) => (
    <SurfaceCard
        treatment="ink"
        ariaLabel={props.offerAria}
        artwork={<Image src="/images/promo/mascot-offer.png" alt="" aspect="auto" fit="contain" />}
    >
        <div className={HERO_COPY}>
            <SectionHeader eyebrow={props.heroEyebrow} title={props.heroTitle} description={props.subline} />
            <div className={HERO_ROW}>
                {/* Grammar gap: a primary Button on the ink band is accent on accent; secondary until an on-ink primary ships. */}
                <Button variant="secondary" href={props.ctaHref}>
                    {props.cta}
                </Button>
                <div className={HERO_COUNTDOWN} role="timer" aria-label={props.countdownAria}>
                    <DescriptionList
                        layout="stat-strip"
                        isDivided
                        items={props.units.map((unit) => ({
                            id: unit.id,
                            term: unit.term,
                            description: unit.value,
                        }))}
                    />
                </div>
            </div>
            <Text size="xs">{props.caption}</Text>
            {props.slots === null ? null : (
                <Meter
                    label={props.slots.label}
                    value={props.slots.claimed}
                    minValue={0}
                    maxValue={props.slots.cap}
                    valueLabel={`${props.slots.claimed}/${props.slots.cap}`}
                />
            )}
            <Text size="xs">{props.conditions}</Text>
        </div>
    </SurfaceCard>
)

/** Draws one of the four Founding 50 campaign presentations from resolved copy. */
export const FoundingOfferBase = (props: FoundingOfferBaseProps) => {
    if (props.state === "pill") return <Pill props={props.props} on={props.on} />
    if (props.state === "strip") return <Strip props={props.props} on={props.on} />
    if (props.state === "inline")
        return <Alert tone="informative" title={props.props.inlineTitle} description={props.props.inlineText} />
    return <Hero props={props.props} on={props.on} />
}
