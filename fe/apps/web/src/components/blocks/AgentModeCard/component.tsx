import { SegmentedControl, SurfaceCard, Text } from "@starci/grammar/common"
import { SlotBoundView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { STACK } from "./classNames"

/** What the mode card shows once the installation arrived. */
export interface ModeView {
    readonly mode: string
    readonly help: string
    /** Authority is shared by every instance of the type; empty for a single instance agent. */
    readonly sharedNote: string
}

/** Copy and slot of the operating mode card. */
export interface AgentModeCardBaseProps {
    readonly props: {
        readonly title: string
        readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly note: string
        readonly isDisabled: boolean
        readonly slot: DataSlot<ModeView>
        readonly placeholder: ModeView
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly mode: (value: string) => void; readonly retry: () => void }
}

/** Draws the operating mode card: assist or autopilot, and what each means. */
export const AgentModeCardBase = (props: AgentModeCardBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <SlotBoundView from={props.props} onRetry={props.on.retry}>
            {(view, isSkeleton) => (
                <div className={STACK}>
                    <SegmentedControl
                        label={props.props.title}
                        isLabelHidden
                        options={props.props.options}
                        value={view.mode}
                        isSkeleton={isSkeleton}
                        isDisabled={props.props.isDisabled}
                        onValueChange={props.on.mode}
                    />
                    <Text size="sm" isSkeleton={isSkeleton}>
                        {view.help}
                    </Text>
                    <Text size="xs" tone="muted">
                        {props.props.note}
                    </Text>
                    {view.sharedNote === "" ? null : (
                        <Text size="xs" tone="muted">
                            {view.sharedNote}
                        </Text>
                    )}
                </div>
            )}
        </SlotBoundView>
    </SurfaceCard>
)
