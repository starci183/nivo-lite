import { KnowledgeRows } from "@/components/composites/KnowledgeRows"
import type { KnowledgeRowsProps } from "@/components/composites/KnowledgeRows"

/** The list the connected the facts in force and the scheduled ones supplies. */
export interface BrainFactsBaseProps {
    readonly props: { readonly list: KnowledgeRowsProps }
}

/** Draws the facts in force and the scheduled ones. */
export const BrainFactsBase = (props: BrainFactsBaseProps) => <KnowledgeRows {...props.props.list} />
