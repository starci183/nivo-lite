import { KnowledgeRowsSlot } from "@/components/frames/KnowledgeRowsSlot"
import type { KnowledgeRowsSlotProps } from "@/components/frames/KnowledgeRowsSlot"

/** The rows and the copy of their status the connected base knowledge supplies. */
export interface KnowledgeNivoBaseProps {
    readonly props: {
        readonly label: string
        readonly slot: KnowledgeRowsSlotProps["slot"]
        readonly slotLabels: KnowledgeRowsSlotProps["slotLabels"]
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the base knowledge of NIVO: one row per item with its module, kind, version and text. */
export const KnowledgeNivoBase = (props: KnowledgeNivoBaseProps) => (
    <KnowledgeRowsSlot
        label={props.props.label}
        slot={props.props.slot}
        slotLabels={props.props.slotLabels}
        isPending={false}
        onRetry={props.on.retry}
    />
)
