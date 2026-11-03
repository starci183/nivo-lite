import { KNOWLEDGE_ROWS_PLACEHOLDER, KnowledgeRowList } from "@/components/composites/KnowledgeRows"
import type { KnowledgeRowView, DataSlot, SlotLabels } from "@/modules/types"
import { SlotView } from "@nivo-lite/agent-sdk/client"

/** The rows and the copy of their status the connected base knowledge supplies. */
export interface KnowledgeNivoBaseProps {
    readonly props: {
        readonly label: string
        readonly slot: DataSlot<ReadonlyArray<KnowledgeRowView>>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the base knowledge of NIVO: one row per item with its module, kind, version and text. */
export const KnowledgeNivoBase = (props: KnowledgeNivoBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={KNOWLEDGE_ROWS_PLACEHOLDER}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
        render={(rows, isSkeleton) => (
            <KnowledgeRowList
                label={props.props.label}
                emptyTitle={props.props.slotLabels.empty}
                rows={rows}
                isPending={false}
                isLoading={isSkeleton}
            />
        )}
    />
)
