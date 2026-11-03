import { ConnectionStepBand } from "@/components/frames/ConnectionStepBand"
import { Switch, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SepayAgentView, SlotLabels } from "@/modules/types"

/** Props for {@link SepayAgentsBase}. */
export interface SepayAgentsBaseProps {
    readonly props: {
        /** The step's band: its place, words and whether it is open. */
        readonly step: {
            readonly ordinal: number
            readonly title: string
            readonly summary: string
            readonly hint: string
            readonly isOpen: boolean
        }
        /** How a credit is matched to an invoice, and what happens to one that is not. */
        readonly matching: string
        readonly slot: DataSlot<ReadonlyArray<SepayAgentView>>
        readonly placeholder: ReadonlyArray<SepayAgentView>
        readonly labels: SlotLabels
        readonly isDisabled: boolean
    }
    readonly on: {
        readonly retry: () => void
        readonly toggle: (agentId: string, isOn: boolean) => void
        readonly toggleStep: (isOpen: boolean) => void
    }
}

/** Draws the body of the last setup step: how matching works, then the accounting agents that may book the credits, each with a switch. */
export const SepayAgentsBase = (props: SepayAgentsBaseProps) => (
    <ConnectionStepBand {...props.props.step} onToggle={props.on.toggleStep}>
        <>
            <Text size="sm">{props.props.matching}</Text>
            <SlotView
                slot={props.props.slot}
                placeholder={props.props.placeholder}
                labels={props.props.labels}
                onRetry={props.on.retry}
                render={(agents, isLoading) =>
                    agents.map((agent) => (
                        <Switch
                            key={agent.id}
                            name={`agent-${agent.id}`}
                            label={agent.name}
                            isSelected={agent.isOn}
                            isLoading={isLoading}
                            isDisabled={props.props.isDisabled || isLoading}
                            onSelectedChange={(isOn) => props.on.toggle(agent.id, isOn)}
                        />
                    ))
                }
            />
        </>
    </ConnectionStepBand>
)
