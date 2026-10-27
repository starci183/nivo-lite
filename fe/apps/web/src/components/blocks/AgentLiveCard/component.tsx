import { Badge, SurfaceCard, Switch, Text } from "@starci/grammar/common"
import { SlotBoundView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { STACK, SWITCH_ROW } from "./classNames"

/** What the card draws once the installation arrived, every word resolved. */
export interface LiveView {
    readonly isLive: boolean
    readonly statusLabel: string
    /** Why the agent cannot go live yet; empty when it can. */
    readonly blocker: string
}

/** Copy and slot of the live card. */
export interface AgentLiveCardBaseProps {
    readonly props: {
        readonly title: string
        readonly switchLabel: string
        readonly help: string
        readonly isDisabled: boolean
        readonly slot: DataSlot<LiveView>
        readonly placeholder: LiveView
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly live: (on: boolean) => void; readonly retry: () => void }
}

/** Draws the live card: the switch with its label kept readable beside it even while the switch is off-limits, the status badge and what it needs before it can go live. */
export const AgentLiveCardBase = (props: AgentLiveCardBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <SlotBoundView from={props.props} onRetry={props.on.retry}>
            {(view, isSkeleton) => (
                <div className={STACK}>
                    <div className={SWITCH_ROW}>
                        <Switch
                            name="live"
                            label={props.props.switchLabel}
                            isLabelHidden
                            isSelected={view.isLive}
                            isSkeleton={isSkeleton}
                            isDisabled={props.props.isDisabled}
                            onSelectedChange={props.on.live}
                        />
                        <Text weight="medium">{props.props.switchLabel}</Text>
                    </div>
                    <Badge isDot isSkeleton={isSkeleton} tone={view.isLive ? "success" : "neutral"}>
                        {view.statusLabel}
                    </Badge>
                    <Text size="sm" tone="muted">
                        {props.props.help}
                    </Text>
                    {view.blocker === "" ? null : <Text size="sm">{view.blocker}</Text>}
                </div>
            )}
        </SlotBoundView>
    </SurfaceCard>
)
