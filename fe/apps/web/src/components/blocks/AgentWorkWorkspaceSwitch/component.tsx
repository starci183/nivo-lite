import { Alert, SurfaceCard, Switch, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels, WorkspaceAgentWorkView } from "@/modules/types"
import { STACK, SWITCH_ROW } from "./classNames"

/** Copy and slot of the work switch of the whole workspace. */
export interface AgentWorkWorkspaceSwitchBaseProps {
    readonly props: {
        readonly title: string
        readonly switchLabel: string
        readonly help: string
        /** Shown while the whole workspace is off, and what that means. */
        readonly offNotice: string
        readonly ownerOnly: string
        readonly isDisabled: boolean
        readonly read: {
            readonly slot: DataSlot<WorkspaceAgentWorkView>
            readonly placeholder: WorkspaceAgentWorkView
            readonly labels: SlotLabels
        }
    }
    readonly on: { readonly change: (on: boolean) => void; readonly retry: () => void }
}

/** Draws the kill switch of the whole workspace on the agents list, with the counts of what waits beside it. */
export const AgentWorkWorkspaceSwitchBase = (props: AgentWorkWorkspaceSwitchBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <SlotView {...props.props.read} forbidden="hide" onRetry={props.on.retry}>
            {(view, isSkeleton) => (
                <div className={STACK}>
                    <div className={SWITCH_ROW}>
                        <Switch
                            name="workspace-agent-work"
                            label={props.props.switchLabel}
                            isLabelHidden
                            isSelected={view.isOn}
                            isSkeleton={isSkeleton}
                            isDisabled={props.props.isDisabled || !view.canChange}
                            onSelectedChange={props.on.change}
                        />
                        <Text weight="medium">{props.props.switchLabel}</Text>
                    </div>
                    <Text size="sm" tone="muted" isSkeleton={isSkeleton}>
                        {props.props.help}
                    </Text>
                    <Text size="sm" isSkeleton={isSkeleton}>
                        {view.countsLabel}
                    </Text>
                    {view.isOn ? null : <Alert title={props.props.offNotice} tone="negative" appearance="soft" />}
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
