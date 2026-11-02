import { EmptyNotice, SurfaceCard, Switch } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
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

/** Draws the body of the last setup step: every agent that can work through a Zalo OA, with a switch for whether it does. */
export const ZaloConnectionAgentsBase = (props: ZaloConnectionAgentsBaseProps) => (
    <SlotView
        slot={props.props.agents}
        placeholder={ZALO_AGENTS_PLACEHOLDER}
        labels={props.props.slotLabels}
        forbidden="notice"
        onRetry={props.on.retry}
        render={(agents, isLoading) => (
            <SurfaceCard
                kind="list"
                label={props.props.title}
                isLoading={isLoading}
                empty={<EmptyNotice message={props.props.slotLabels.empty} />}
                items={agents.map((agent): ListRowData => {
                    const item = { id: agent.id, title: agent.name }
                    if (props.props.canToggle)
                        return {
                            ...item,
                            detail: (
                                <Switch
                                    name={`agent-${agent.id}`}
                                    label={`${props.props.switchLabel} ${agent.name}`}
                                    isLabelHidden
                                    isSelected={agent.isOn}
                                    isLoading={isLoading}
                                    onSelectedChange={(isOn) => props.on.toggle(agent.id, isOn)}
                                />
                            ),
                        }
                    if (agent.isOn) return { ...item, badges: [{ label: props.props.onLabel, tone: "success" }] }
                    return item
                })}
            />
        )}
    />
)
