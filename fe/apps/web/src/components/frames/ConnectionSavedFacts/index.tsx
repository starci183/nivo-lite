import { DescriptionList, Text } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { ConnectionFactView, DataSlot, SlotLabels } from "@/modules/types"

/** Fake rows of the same shape: the skeleton reuses the ready tree. */
const SAVED_FACTS_PLACEHOLDER: ReadonlyArray<ConnectionFactView> = [
    { id: "one", label: "-", value: "-" },
    { id: "two", label: "-", value: "-" },
    { id: "three", label: "-", value: "-" },
]

/** The saved values of a connection and the copy of their read status. */
export interface ConnectionSavedFactsProps {
    readonly facts: DataSlot<ReadonlyArray<ConnectionFactView>>
    readonly slotLabels: SlotLabels
    readonly onRetry: () => void
}

/** Draws the saved values of a connection as a description list, each value strong. */
export const ConnectionSavedFacts = (props: ConnectionSavedFactsProps) => (
    <SlotView
        slot={props.facts}
        placeholder={SAVED_FACTS_PLACEHOLDER}
        labels={props.slotLabels}
        onRetry={props.onRetry}
        render={(facts, isLoading) => (
            <DescriptionList
                layout="columns"
                isLoading={isLoading}
                items={facts.map((fact) => ({
                    id: fact.id,
                    term: fact.label,
                    description: <Text isStrong>{fact.value}</Text>,
                }))}
            />
        )}
    />
)
