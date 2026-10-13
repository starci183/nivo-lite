import { KnowledgeNivo } from "@/components/blocks/KnowledgeNivo"
import { KnowledgeFrame } from "@/components/blocks/KnowledgeFrame"

/** Copy and values the base knowledge page supplies. */
export interface KnowledgeNivoPageBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbHome: string
        readonly homeHref: string
        readonly crumbBrain: string
        readonly brainHref: string
        readonly crumbDocuments: string
        readonly documentsHref: string
        readonly eyebrow: string
        readonly title: string
        readonly description: string
    }
}

/** Draws the base knowledge of NIVO under its trail and heading. */
export const KnowledgeNivoPageBase = (props: KnowledgeNivoPageBaseProps) => (
    <KnowledgeFrame {...props.props}>
        <KnowledgeNivo />
    </KnowledgeFrame>
)
