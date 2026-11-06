import { EmptyNotice, SurfaceCard, Text } from "@starci/grammar/common"

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
        readonly liveLabel: string
        readonly roadmapLabel: string
        readonly note: string
        readonly emptyLabel: string
        readonly channels: ReadonlyArray<LandingConnectChannel>
    }
}

/**
 * The channel that works today and the ones on the roadmap. The channel state is stated in words on a badge;
 * only the live channel takes a status tone.
 */
export const LandingConnectBase = (props: LandingConnectBaseProps) => (
    <div id={props.props.headingId}>
        <SurfaceCard
            kind="list"
            label={props.props.title}
            fact={props.props.eyebrow}
            headingLevel={2}
            note={props.props.note}
            headers={[{ kind: "custom", children: <Text>{props.props.lead}</Text> }]}
            items={props.props.channels.map((channel) => ({
                id: channel.id,
                title: channel.name,
                description: channel.text,
                badges: [
                    {
                        label: channel.isLive ? props.props.liveLabel : props.props.roadmapLabel,
                        tone: channel.isLive ? "success" : "neutral",
                        isDot: channel.isLive,
                    },
                ],
            }))}
            empty={<EmptyNotice message={props.props.emptyLabel} />}
        />
    </div>
)
