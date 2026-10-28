import { ListRow, Switch } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { ZaloSection } from "@/components/composites/ZaloSection"
import type { DataSlot, SlotLabels, ZaloAgentRowView } from "@/modules/types"

/** Fake rows of the same shape: the skeleton reuses the ready tree. */
export const ZALO_AGENTS_PLACEHOLDER: ReadonlyArray<ZaloAgentRowView> = [
    { id: "one", name: "-", isOn: false },
    { id: "two", name: "-", isOn: false },
]

/** Copy, slot and command of the agents that may use the connection. */
export interface ZaloConnectionAgentsBaseProps {
    readonly props: {
        readonly title: string
        readonly agents: DataSlot<ReadonlyArray<ZaloAgentRowView>>
        readonly slotLabels: SlotLabels
        readonly switchLabel: string
    }
    readonly on: { readonly toggle: (agentId: string, isOn: boolean) => void; readonly retry: () => void }
}

/** Draws the agents tab: every agent of the workspace with a switch for whether it works through this connection. */
export const ZaloConnectionAgentsBase = (props: ZaloConnectionAgentsBaseProps) => (
    <SlotView
        slot={props.props.agents}
        placeholder={ZALO_AGENTS_PLACEHOLDER}
        labels={props.props.slotLabels}
        forbidden="notice"
        onRetry={props.on.retry}
    >
        {(agents, isSkeleton) => (
            <ZaloSection title={props.props.title} isSkeleton={isSkeleton}>
                {agents.map((agent) => (
                    <ListRow
                        key={agent.id}
                        title={agent.name}
                        isSkeleton={isSkeleton}
                        actions={
                            <Switch
                                name={`agent-${agent.id}`}
                                label={`${props.props.switchLabel} ${agent.name}`}
                                isLabelHidden
                                isSelected={agent.isOn}
                                isSkeleton={isSkeleton}
                                onSelectedChange={(isOn) => props.on.toggle(agent.id, isOn)}
                            />
                        }
                    />
                ))}
            </ZaloSection>
        )}
    </SlotView>
)
