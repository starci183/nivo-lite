import { KnowledgeDocs } from "@/components/blocks/KnowledgeDocs"
import type { BrainPageHeading } from "@/modules/types"

/** The heading and the document the document page supplies. */
export interface KnowledgeSourcePageBaseProps {
    readonly props: {
        readonly heading: BrainPageHeading
        /** The document of the address; undefined while the page only shows its skeleton. */
        readonly sourceId: string | undefined
    }
}

/** Draws one document as the middle pane of the documents screen, the list kept beside it. */
export const KnowledgeSourcePageBase = (props: KnowledgeSourcePageBaseProps) => (
    <KnowledgeDocs heading={props.props.heading} selection={{ kind: "doc", id: props.props.sourceId }} />
)
