import { SurfaceCard } from "@starci/grammar/common"
import { SwitchStatus } from "@/components/composites/SwitchStatus"
import type { SwitchStatusProps } from "@/components/composites/SwitchStatus"
import { SlotView } from "@/components/composites/SlotView"
import type { AgentWorkSwitchView, DataSlot, SlotLabels } from "@/modules/types"

/** Copy and slot of the work switch card of one agent. */
export interface AgentWorkSwitchCardBaseProps {
    readonly props: {
        readonly title: string
        readonly switchLabel: string
        readonly help: string
        /** Said to anyone but the owner, who may read the switch and not move it. */
        readonly ownerOnly: string
        readonly isDisabled: boolean
        readonly read: {
            readonly slot: DataSlot<AgentWorkSwitchView>
            readonly placeholder: AgentWorkSwitchView
            readonly labels: SlotLabels
        }
    }
    readonly on: { readonly change: (on: boolean) => void; readonly retry: () => void }
}

/** The switch and its status, locked for anyone who may read it and not move it. */
const switchOf = (
    base: AgentWorkSwitchCardBaseProps,
    view: AgentWorkSwitchView,
    isSkeleton: boolean,
): SwitchStatusProps => ({
    label: base.props.switchLabel,
    isSelected: view.isOn,
    isSkeleton,
    isDisabled: base.props.isDisabled || !view.canChange,
    onChange: base.on.change,
    tone: view.tone,
    statusLabel: view.statusLabel,
    help: base.props.help,
    blocker: "",
    blockerAction: null,
    quiet: view.canChange ? "" : base.props.ownerOnly,
})

/** Draws the kill switch of one agent: its label stays readable beside the switch, and the card says who may move it. */
export const AgentWorkSwitchCardBase = (props: AgentWorkSwitchCardBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <SlotView {...props.props.read} onRetry={props.on.retry}>
            {(view, isSkeleton) => <SwitchStatus {...switchOf(props, view, isSkeleton)} />}
        </SlotView>
    </SurfaceCard>
)
