import { Alert, Cluster, Stack, SurfaceCard, Switch, Text } from "@starci/grammar/common"
import { SlotView } from "@nivo/agent-sdk/workbench"
import type { DataSlot, SlotLabels, WorkspaceAgentWorkView } from "@/modules/types"

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
        <SlotView
            {...props.props.read}
            forbidden="hide"
            onRetry={props.on.retry}
            render={(view, isLoading) => (
                <Stack gap="section">
                    <Cluster gap="row">
                        <Switch
                            name="workspace-agent-work"
                            label={props.props.switchLabel}
                            isLabelHidden
                            isSelected={view.isOn}
                            isLoading={isLoading}
                            isDisabled={props.props.isDisabled || !view.canChange}
                            onSelectedChange={props.on.change}
                        />
                        <Text isStrong>{props.props.switchLabel}</Text>
                    </Cluster>
                    <Text size="sm" tone="muted" isLoading={isLoading}>
                        {props.props.help}
                    </Text>
                    <Text size="sm" isLoading={isLoading}>
                        {view.countsLabel}
                    </Text>
                    {view.isOn ? null : <Alert title={props.props.offNotice} tone="negative" appearance="soft" />}
                    {view.canChange ? null : (
                        <Text size="sm" tone="muted">
                            {props.props.ownerOnly}
                        </Text>
                    )}
                </Stack>
            )}
        />
    </SurfaceCard>
)
