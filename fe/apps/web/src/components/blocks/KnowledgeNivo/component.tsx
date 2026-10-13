import { KnowledgeRows } from "@/components/composites/KnowledgeRows"
import type { KnowledgeRowsProps } from "@/components/composites/KnowledgeRows"

/** The list the connected base knowledge supplies. */
export interface KnowledgeNivoBaseProps {
    readonly props: { readonly list: KnowledgeRowsProps }
}

/** Draws the base knowledge of NIVO: one row per item with its module, kind, version and text. */
export const KnowledgeNivoBase = (props: KnowledgeNivoBaseProps) => <KnowledgeRows {...props.props.list} />
