import { SlotView } from "@nivo-lite/agent-sdk/client"
import { KNOWLEDGE_ROWS_PLACEHOLDER, KnowledgeRowList } from "@/components/composites/KnowledgeRows"
import type { DataSlot, KnowledgeRowView, SlotLabels } from "@/modules/types"

/** The rows, the copy of their status and whether a change is pending. */
export interface KnowledgeRowsSlotProps {
    readonly label: string
    readonly slot: DataSlot<ReadonlyArray<KnowledgeRowView>>
    readonly slotLabels: SlotLabels
    readonly isPending: boolean
    readonly onRetry: () => void
}

/** Draws knowledge rows through their own read status. */
export const KnowledgeRowsSlot = (props: KnowledgeRowsSlotProps) => (
    <SlotView
        slot={props.slot}
        placeholder={KNOWLEDGE_ROWS_PLACEHOLDER}
        labels={props.slotLabels}
        onRetry={props.onRetry}
        render={(rows, isLoading) => (
            <KnowledgeRowList
                label={props.label}
                emptyTitle={props.slotLabels.empty}
                rows={rows}
                isPending={props.isPending}
                isLoading={isLoading}
            />
        )}
    />
)
