import {
    Badge,
    Button,
    PageContainer,
    Region,
    SectionHeader,
    ListRow,
    SurfaceListCard,
    Text,
} from "@starci/grammar/common"
import { CONNECT_COPY, CONNECT_GRID, SECTION_STACK } from "./classNames"

/** One channel of the list: its words and whether it works today. */
interface LandingConnectChannel {
    readonly id: string
    readonly name: string
    readonly text: string
    readonly isLive: boolean
}

/** The resolved words the connect section draws. */
interface LandingConnectBaseProps {
    readonly props: {
        readonly headingId: string
        readonly eyebrow: string
        readonly title: string
        readonly lead: string
        readonly ctaLabel: string
        readonly ctaHref: string
        readonly liveLabel: string
        readonly roadmapLabel: string
        readonly note: string
        readonly channels: ReadonlyArray<LandingConnectChannel>
    }
}

/**
 * The channel that works today and the ones on the roadmap. The channel state is stated in words on a badge;
 * only the live channel takes a status tone.
 */
export const LandingConnectBase = (props: LandingConnectBaseProps) => (
    <Region labelledBy={props.props.headingId}>
        <PageContainer measure="product">
            <div className={CONNECT_GRID}>
                <div className={CONNECT_COPY}>
                    <SectionHeader
                        id={props.props.headingId}
                        eyebrow={props.props.eyebrow}
                        title={props.props.title}
                        description={props.props.lead}
                    />
                    <Button variant="primary" size="lg" href={props.props.ctaHref}>
                        {props.props.ctaLabel}
                    </Button>
                </div>
                <div className={SECTION_STACK}>
                    <SurfaceListCard ariaLabel={props.props.title}>
                        {props.props.channels.map((channel) => (
                            <ListRow
                                key={channel.id}
                                title={channel.name}
                                description={channel.text}
                                badges={
                                    channel.isLive ? (
                                        <Badge tone="success" isDot>
                                            {props.props.liveLabel}
                                        </Badge>
                                    ) : (
                                        <Badge tone="neutral">{props.props.roadmapLabel}</Badge>
                                    )
                                }
                            />
                        ))}
                    </SurfaceListCard>
                    <Text size="sm" tone="muted">
                        {props.props.note}
                    </Text>
                </div>
            </div>
        </PageContainer>
    </Region>
)
