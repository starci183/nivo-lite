import { Badge, Button, Cluster, ListRow, SurfaceListCard } from "@starci/grammar/common"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import { FirstRunCard } from "@/components/composites/FirstRunCard"

/** One channel the step offers: its name, what it brings, its mark and whether the workspace already has it. */
export interface OnboardingChannelView {
    readonly id: string
    readonly name: string
    readonly description: string
    readonly logo?: string | undefined
    /** Opens the provider's connection wizard drawer on this page. */
    readonly connectHref: string
    readonly isConnected: boolean
}

/** Copy and values the connected channels step supplies. */
export interface OnboardingChannelsBaseProps {
    readonly props: {
        readonly title: string
        readonly heading: string
        readonly description: string
        readonly channels: ReadonlyArray<OnboardingChannelView>
        readonly connectLabel: string
        readonly connectedLabel: string
        readonly backLabel: string
        readonly backHref: string
        readonly laterLabel: string
        readonly continueLabel: string
        readonly nextHref: string
    }
}

/** Draws the channels step: the question, one row per channel with its connect button (or its connected mark), and the ways on. */
export const OnboardingChannelsBase = (props: OnboardingChannelsBaseProps) => {
    const view = props.props
    return (
        <FirstRunCard
            title={view.title}
            heading={view.heading}
            description={view.description}
            actions={
                <>
                    <Button intent="neutral" href={view.backHref}>
                        {view.backLabel}
                    </Button>
                    <Cluster gap="row">
                        <Button intent="neutral" href={view.nextHref}>
                            {view.laterLabel}
                        </Button>
                        <Button intent="commit" href={view.nextHref}>
                            {view.continueLabel}
                        </Button>
                    </Cluster>
                </>
            }
        >
            <SurfaceListCard ariaLabel={view.title}>
                {view.channels.map((channel) => (
                    <ListRow
                        key={channel.id}
                        title={channel.name}
                        description={channel.description}
                        leading={
                            <ProviderLogo glyph="chat" {...(channel.logo === undefined ? {} : { src: channel.logo })} />
                        }
                        badges={channel.isConnected ? <Badge tone="success">{view.connectedLabel}</Badge> : undefined}
                        actions={
                            channel.isConnected ? undefined : (
                                <Button intent="neutral" href={channel.connectHref}>
                                    {view.connectLabel}
                                </Button>
                            )
                        }
                    />
                ))}
            </SurfaceListCard>
        </FirstRunCard>
    )
}
