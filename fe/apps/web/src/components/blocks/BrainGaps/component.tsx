import { KnowledgeRows } from "@/components/composites/KnowledgeRows"
import type { KnowledgeRowsProps } from "@/components/composites/KnowledgeRows"

/** The list the connected the questions customers asked that the brain could not answer supplies. */
export interface BrainGapsBaseProps {
    readonly props: { readonly list: KnowledgeRowsProps }
}

/** Draws the questions customers asked that the brain could not answer. */
export const BrainGapsBase = (props: BrainGapsBaseProps) => <KnowledgeRows {...props.props.list} />
