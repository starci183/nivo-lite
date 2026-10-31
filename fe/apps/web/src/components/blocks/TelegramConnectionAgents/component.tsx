import { ConnectionAgentSwitches } from "@/components/composites/ConnectionAgentSwitches"
import { SlotView } from "@/components/composites/SlotView"
import type { ConnectionAgentRowView, DataSlot, SlotLabels } from "@/modules/types"

/** Fake rows of the same shape: the skeleton reuses the ready tree. */
const AGENTS_PLACEHOLDER: ReadonlyArray<ConnectionAgentRowView> = [
    { id: "one", name: "-", isOn: false },
    { id: "two", name: "-", isOn: false },
]

/** Copy, slot and command of the agents that may use the bot. */
export interface TelegramConnectionAgentsBaseProps {
    readonly props: {
        readonly title: string
        readonly agents: DataSlot<ReadonlyArray<ConnectionAgentRowView>>
        readonly slotLabels: SlotLabels
        readonly switchLabel: string
        readonly onLabel: string
        /** Only the owner may change which agents work through the bot. */
        readonly canToggle: boolean
    }
    readonly on: { readonly toggle: (agentId: string, isOn: boolean) => void; readonly retry: () => void }
}

/** Draws the body of the last step: every agent that can work through a Telegram bot, with a switch for whether it does. */
export const TelegramConnectionAgentsBase = (props: TelegramConnectionAgentsBaseProps) => (
    <SlotView
        slot={props.props.agents}
        placeholder={AGENTS_PLACEHOLDER}
        labels={props.props.slotLabels}
        forbidden="notice"
        onRetry={props.on.retry}
    >
        {(agents, isSkeleton) => (
            <ConnectionAgentSwitches
                title={props.props.title}
                agents={agents}
                isSkeleton={isSkeleton}
                switchLabel={props.props.switchLabel}
                onLabel={props.props.onLabel}
                canToggle={props.props.canToggle}
                onToggle={props.on.toggle}
            />
        )}
    </SlotView>
)
