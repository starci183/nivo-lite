import { Switch, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SepayAgentView, SlotLabels } from "@/modules/types"

/** Props for {@link SepayAgentsBase}. */
export interface SepayAgentsBaseProps {
    readonly props: {
        /** How a credit is matched to an invoice, and what happens to one that is not. */
        readonly matching: string
        readonly slot: DataSlot<ReadonlyArray<SepayAgentView>>
        readonly placeholder: ReadonlyArray<SepayAgentView>
        readonly labels: SlotLabels
        readonly isDisabled: boolean
    }
    readonly on: { readonly retry: () => void; readonly toggle: (agentId: string, isOn: boolean) => void }
}

/** Draws the body of the last setup step: how matching works, then the accounting agents that may book the credits, each with a switch. */
export const SepayAgentsBase = (props: SepayAgentsBaseProps) => (
    <>
        <Text size="sm">{props.props.matching}</Text>
        <SlotView
            slot={props.props.slot}
            placeholder={props.props.placeholder}
            labels={props.props.labels}
            onRetry={props.on.retry}
        >
            {(agents, isSkeleton) =>
                agents.map((agent) => (
                    <Switch
                        key={agent.id}
                        name={`agent-${agent.id}`}
                        label={agent.name}
                        isSelected={agent.isOn}
                        isSkeleton={isSkeleton}
                        isDisabled={props.props.isDisabled || isSkeleton}
                        onSelectedChange={(isOn) => props.on.toggle(agent.id, isOn)}
                    />
                ))
            }
        </SlotView>
    </>
)
