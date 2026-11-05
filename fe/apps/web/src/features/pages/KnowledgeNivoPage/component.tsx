import { KnowledgeDocs } from "@/components/blocks/KnowledgeDocs"
import type { BrainPageHeading } from "@/modules/types"

/** The heading the base knowledge page supplies. */
export interface KnowledgeNivoPageBaseProps {
    readonly props: {
        readonly heading: BrainPageHeading
    }
}

/** Draws the base knowledge of NIVO as the NIVO base filter of the documents screen: the same list, read only. */
export const KnowledgeNivoPageBase = (props: KnowledgeNivoPageBaseProps) => (
    <KnowledgeDocs heading={props.props.heading} selection={{ kind: "nivo" }} />
)
