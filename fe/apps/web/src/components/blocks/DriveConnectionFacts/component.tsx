import { SlotView } from "@nivo-lite/agent-sdk/client"
import { CONNECTION_FACTS_PLACEHOLDER, ConnectionFactsCard } from "@/components/composites/ConnectionFactsCard"
import type { ConnectionFactView, DataSlot, SlotLabels } from "@/modules/types"

/** The words, the read and the retry of the details of the Google Drive account. */
export interface DriveConnectionFactsBaseProps {
    readonly props: {
        readonly title: string
        readonly facts: DataSlot<ReadonlyArray<ConnectionFactView>>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the details of the Google Drive account (account, permission given, documents read, last read, allowance) as term and value rows. */
export const DriveConnectionFactsBase = (props: DriveConnectionFactsBaseProps) => (
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
