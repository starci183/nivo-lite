import { Badge, SurfaceCard, Switch, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { AgentWorkSwitchView, DataSlot, SlotLabels } from "@/modules/types"
import { STACK, SWITCH_ROW } from "./classNames"

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

/** Draws the kill switch of one agent: its label stays readable beside the switch, and the card says who may move it. */
export const AgentWorkSwitchCardBase = (props: AgentWorkSwitchCardBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <SlotView {...props.props.read} onRetry={props.on.retry}>
            {(view, isSkeleton) => (
                <div className={STACK}>
                    <div className={SWITCH_ROW}>
                        <Switch
                            name="agent-work"
                            label={props.props.switchLabel}
                            isLabelHidden
                            isSelected={view.isOn}
                            isSkeleton={isSkeleton}
                            isDisabled={props.props.isDisabled || !view.canChange}
                            onSelectedChange={props.on.change}
                        />
                        <Text weight="medium">{props.props.switchLabel}</Text>
                    </div>
                    <Badge isDot isSkeleton={isSkeleton} tone={view.tone}>
                        {view.statusLabel}
                    </Badge>
                    <Text size="sm" tone="muted">
                        {props.props.help}
                    </Text>
                    {view.canChange ? null : (
                        <Text size="sm" tone="muted">
                            {props.props.ownerOnly}
                        </Text>
                    )}
                </div>
            )}
        </SlotView>
    </SurfaceCard>
)
