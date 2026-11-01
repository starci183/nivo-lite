import { SurfaceCard } from "@starci/grammar/common"
import { SwitchStatus } from "@/components/composites/SwitchStatus"
import type { SwitchStatusProps } from "@/components/composites/SwitchStatus"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** What the card draws once the installation arrived, every word resolved. */
export interface LiveView {
    readonly isLive: boolean
    /** The one state of the agent in words: the label every other screen shows for it. */
    readonly statusLabel: string
    readonly statusTone: SwitchStatusProps["tone"]
    /** Why the agent cannot go live yet; empty when it can. */
    readonly blocker: string
    /** The step that clears the blocker, as a button to Setup; null when nothing blocks. */
    readonly blockerAction: SwitchStatusProps["blockerAction"]
}

/** Copy and slot of the live card. */
export interface AgentLiveCardBaseProps {
    readonly props: {
        readonly title: string
        readonly switchLabel: string
        readonly help: string
        readonly isDisabled: boolean
        /** The read, its same-shape placeholder and the words of its states, as SlotView takes them. */
        readonly read: {
            readonly slot: DataSlot<LiveView>
            readonly placeholder: LiveView
            readonly labels: SlotLabels
        }
    }
    readonly on: { readonly live: (on: boolean) => void; readonly retry: () => void }
}

/** The switch, its status and what it needs, from the read installation. */
const switchOf = (base: AgentLiveCardBaseProps, view: LiveView, isSkeleton: boolean): SwitchStatusProps => ({
    label: base.props.switchLabel,
    isSelected: view.isLive,
    isSkeleton,
    isDisabled: base.props.isDisabled,
    onChange: base.on.live,
    tone: view.statusTone,
    statusLabel: view.statusLabel,
    help: base.props.help,
    blocker: view.blocker,
    blockerAction: view.blockerAction,
    quiet: "",
})

/** Draws the live card: the switch with its label kept readable beside it even while the switch is off-limits, the status badge and what it needs before it can go live. */
export const AgentLiveCardBase = (props: AgentLiveCardBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <SlotView {...props.props.read} onRetry={props.on.retry}>
            {(view, isSkeleton) => <SwitchStatus {...switchOf(props, view, isSkeleton)} />}
        </SlotView>
    </SurfaceCard>
)
