import { Fragment } from "react"
import {
    Avatar,
    Badge,
    Button,
    Cluster,
    Grid,
    Heading,
    Image,
    IncludedMark,
    List,
    ListRow,
    PageContainer,
    Region,
    Stack,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import { LandingBrowserFrame } from "@/components/composites/LandingBrowserFrame"
import { HERO_ART_BAND, LEAD_MEASURE } from "./classNames"

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
            <Stack gap="section">
                <Grid kind="cards" columns={2}>
                    <Stack gap="section" align="start">
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
                        <Cluster gap="row">
                            <Button intent="commit" size="lg" href={props.props.ctaHref}>
                                {props.props.ctaLabel}
                            </Button>
                            <Button intent="alternative" size="lg" href={props.props.secondaryHref}>
                                {props.props.secondaryLabel}
                            </Button>
                        </Cluster>
                        <Cluster gap="row">
                            {props.props.facts.map((fact) => (
                                <Cluster key={fact} gap="inline">
                                    <IncludedMark />
                                    <Text size="sm">{fact}</Text>
                                </Cluster>
                            ))}
                        </Cluster>
                        <Text size="xs" tone="muted">
                            {props.props.tagline}
                        </Text>
                    </Stack>
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
                </Grid>
                <LandingBrowserFrame
                    src={props.props.shotSrc}
                    alt={props.props.shotAlt}
                    label={props.props.shotCaption}
                    width={1440}
                    height={830}
                    priority
                />
            </Stack>
        </PageContainer>
    </Region>
)
