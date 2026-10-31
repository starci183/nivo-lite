import { Badge, List, ListRow, Switch } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
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
        /** What a non-owner reads in place of the switch on an agent that works through the connection. */
        readonly onLabel: string
        /** Only the owner may change which agents work through the connection. */
        readonly canToggle: boolean
    }
    readonly on: { readonly toggle: (agentId: string, isOn: boolean) => void; readonly retry: () => void }
}

/** What a non-owner reads in place of the switch: a badge on an agent that works through the connection, nothing on the others. */
const readOnlyMark = (agent: ZaloAgentRowView, label: string) =>
    agent.isOn ? <Badge tone="success">{label}</Badge> : undefined

/** Draws the body of the last setup step: every agent that can work through a Zalo OA, with a switch for whether it does. */
export const ZaloConnectionAgentsBase = (props: ZaloConnectionAgentsBaseProps) => (
    <SlotView
        slot={props.props.agents}
        placeholder={ZALO_AGENTS_PLACEHOLDER}
        labels={props.props.slotLabels}
        forbidden="notice"
        onRetry={props.on.retry}
    >
        {(agents, isSkeleton) => (
            <List label={props.props.title} aria-busy={isSkeleton}>
                {agents.map((agent) => (
                    <ListRow
                        key={agent.id}
                        title={agent.name}
                        isSkeleton={isSkeleton}
                        actions={
                            props.props.canToggle ? (
                                <Switch
                                    name={`agent-${agent.id}`}
                                    label={`${props.props.switchLabel} ${agent.name}`}
                                    isLabelHidden
                                    isSelected={agent.isOn}
                                    isSkeleton={isSkeleton}
                                    onSelectedChange={(isOn) => props.on.toggle(agent.id, isOn)}
                                />
                            ) : (
                                readOnlyMark(agent, props.props.onLabel)
                            )
                        }
                    />
                ))}
            </List>
        )}
    </SlotView>
)
