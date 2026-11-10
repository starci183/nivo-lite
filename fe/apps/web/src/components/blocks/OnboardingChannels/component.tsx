import { Button, EmptyNotice } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import { FirstRunCard } from "@/components/frames/FirstRunCard"

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
                    <Button endArrow intent="commit" href={view.nextHref}>
                        {view.channels.some((channel) => channel.isConnected) ? view.continueLabel : view.laterLabel}
                    </Button>
                </>
            }
            collection={{
                kind: "list",
                items: view.channels.map((channel) => ({
                    id: channel.id,
                    title: channel.name,
                    description: channel.description,
                    leading:
                        channel.logo === undefined
                            ? { icon: nivoIconSource("chat", "leading") }
                            : { avatar: { name: channel.name, src: channel.logo, shape: "square" } },
                    ...(channel.isConnected
                        ? { badges: [{ label: view.connectedLabel, tone: "success" }] }
                        : { action: { label: view.connectLabel, intent: "neutral", href: channel.connectHref } }),
                })),
                empty: <EmptyNotice message={view.description} />,
            }}
        />
    )
}
