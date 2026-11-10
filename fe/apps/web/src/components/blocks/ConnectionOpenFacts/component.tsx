import { SlotView } from "@nivo-lite/agent-sdk/client"
import { CONNECTION_FACTS_PLACEHOLDER, ConnectionFactsCard } from "@/components/composites/ConnectionFactsCard"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** One labelled fact. */
interface ConnectionOpenFactRow {
    readonly id: string
    readonly label: string
    readonly value: string
}

/** The words and the read of the details card of a connection without a page of its own. */
export interface ConnectionOpenFactsBaseProps {
    readonly props: {
        readonly title: string
        readonly facts: DataSlot<ReadonlyArray<ConnectionOpenFactRow>>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the connection's details as term and value rows: its type, name, details, environment, who uses it and its latest event. */
export const ConnectionOpenFactsBase = (props: ConnectionOpenFactsBaseProps) => (
    <SlotView
        slot={props.props.facts}
        placeholder={CONNECTION_FACTS_PLACEHOLDER}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
        render={(facts, isLoading) => (
            <ConnectionFactsCard title={props.props.title} facts={facts} isLoading={isLoading} />
        )}
    />
)
