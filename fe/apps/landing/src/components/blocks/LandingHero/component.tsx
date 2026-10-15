import { Fragment } from "react"
import {
    Avatar,
    Badge,
    Button,
    Heading,
    Image,
    IncludedMark,
    List,
    ListRow,
    PageContainer,
    Region,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import { LandingBrowserFrame } from "@/components/composites/LandingBrowserFrame"
import {
    HERO_ACTIONS,
    HERO_ART_BAND,
    HERO_COPY,
    HERO_FACT,
    HERO_FACTS,
    HERO_GRID,
    LEAD_MEASURE,
    SECTION_STACK,
} from "./classNames"

/** One row of the "what NIVO follows today" card. */
interface LandingHeroRow {
    readonly id: string
    readonly name: string
    readonly title: string
    readonly description: string
    readonly badge: string
    readonly badgeTone: "warning" | "success"
}

/** The resolved words and addresses the hero draws. */
interface LandingHeroBaseProps {
    readonly props: {
        readonly regionLabel: string
        readonly offerBadge: string
        readonly titleLines: ReadonlyArray<string>
        readonly lead: string
        readonly ctaLabel: string
        readonly ctaHref: string
        readonly secondaryLabel: string
        readonly secondaryHref: string
        readonly facts: ReadonlyArray<string>
        readonly tagline: string
        readonly cardTitle: string
        readonly cardListLabel: string
        readonly rows: ReadonlyArray<LandingHeroRow>
        readonly artSrc: string
        readonly shotSrc: string
        readonly shotAlt: string
        readonly shotCaption: string
    }
}

/** Hero, the page's focal point: promise and calls to action, one "what NIVO follows today" card, one large product shot. */
export const LandingHeroBase = (props: LandingHeroBaseProps) => (
    <Region label={props.props.regionLabel}>
        <PageContainer measure="product">
            <div className={SECTION_STACK}>
                <div className={HERO_GRID}>
                    <div className={HERO_COPY}>
                        <Badge tone="accent">{props.props.offerBadge}</Badge>
                        <Heading level={1} scale="display">
                            {props.props.titleLines.map((line, position) => (
                                <Fragment key={line}>
                                    {position > 0 ? <br /> : null}
                                    {line}
                                </Fragment>
                            ))}
                        </Heading>
                        <div className={LEAD_MEASURE}>
                            <Text tone="muted">{props.props.lead}</Text>
                        </div>
                        <div className={HERO_ACTIONS}>
                            <Button variant="primary" size="lg" width="fill" href={props.props.ctaHref}>
                                {props.props.ctaLabel}
                            </Button>
                            <Button variant="secondary" size="lg" width="fill" href={props.props.secondaryHref}>
                                {props.props.secondaryLabel}
                            </Button>
                        </div>
                        <div className={HERO_FACTS}>
                            {props.props.facts.map((fact) => (
                                <div key={fact} className={HERO_FACT}>
                                    <IncludedMark />
                                    <Text size="sm">{fact}</Text>
                                </div>
                            ))}
                        </div>
                        <Text size="xs" tone="muted">
                            {props.props.tagline}
                        </Text>
                    </div>
                    <SurfaceCard label={props.props.cardTitle} headingLevel={2} composition="joined">
                        <div className={HERO_ART_BAND} aria-hidden="true">
                            <Image src={props.props.artSrc} alt="" aspect="wide" fit="contain" plate="none" />
                        </div>
                        <List label={props.props.cardListLabel}>
                            {props.props.rows.map((row) => (
                                <ListRow
                                    key={row.id}
                                    leading={<Avatar name={row.name} size="md" isDecorative />}
                                    title={row.title}
                                    description={row.description}
                                    badges={<Badge tone={row.badgeTone}>{row.badge}</Badge>}
                                />
                            ))}
                        </List>
                    </SurfaceCard>
                </div>
                <LandingBrowserFrame
                    src={props.props.shotSrc}
                    alt={props.props.shotAlt}
                    label={props.props.shotCaption}
                    width={1440}
                    height={830}
                    priority
                />
            </div>
        </PageContainer>
    </Region>
)
