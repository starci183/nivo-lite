import {
    Badge,
    Button,
    Cluster,
    EmptyNotice,
    Grid,
    Heading,
    Image,
    Stack,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import { LandingBrowserFrame } from "@/components/composites/LandingBrowserFrame"
import { IconGlyph } from "@/components/leaves/Icon"
import type { ListRowData } from "@starci/grammar/common"

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

/** The hero keeps its single visible h1; Page already owns its measure and inset. */
export const LandingHeroBase = (props: LandingHeroBaseProps) => (
    <>
        <Stack gap="section">
            <Grid
                kind="main-rail"
                railWidth="wide"
                primary={
                    <Stack gap="section" align="start">
                        <Badge tone="accent">{props.props.offerBadge}</Badge>
                        <Heading level={1} scale="display">
                            {props.props.titleLines.join(" ")}
                        </Heading>
                        <Stack gap="identity" measure="reading">
                            <Text tone="muted">{props.props.lead}</Text>
                        </Stack>
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
                                    <IconGlyph name="complete" usage="leading" />
                                    <Text size="sm">{fact}</Text>
                                </Cluster>
                            ))}
                        </Cluster>
                        <Text size="xs" tone="muted">
                            {props.props.tagline}
                        </Text>
                    </Stack>
                }
                rail={
                    <SurfaceCard
                        kind="list"
                        label={props.props.cardTitle}
                        headingLevel={2}
                        headers={[
                            {
                                kind: "custom",
                                children: (
                                    <Image src={props.props.artSrc} alt="" aspect="wide" fit="contain" plate="none" />
                                ),
                            },
                        ]}
                        items={props.props.rows.map((row): ListRowData => ({
                            id: row.id,
                            title: row.title,
                            description: row.description,
                            leading: { avatar: { name: row.name } },
                            badges: [{ label: row.badge, tone: row.badgeTone }],
                        }))}
                        empty={<EmptyNotice message={props.props.cardListLabel} />}
                    />
                }
            />
            <LandingBrowserFrame
                src={props.props.shotSrc}
                alt={props.props.shotAlt}
                label={props.props.shotCaption}
                width={1440}
                height={830}
                priority
            />
        </Stack>
    </>
)
