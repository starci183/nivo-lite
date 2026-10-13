import { KnowledgeFrame } from "@/components/blocks/KnowledgeFrame"
import { KnowledgeSourcePanel } from "@/components/blocks/KnowledgeSourcePanel"

/** Copy and values the document page supplies. */
export interface KnowledgeSourcePageBaseProps {
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
        /** The document of the address; undefined while the page only shows its skeleton. */
        readonly sourceId: string | undefined
    }
}

/** Draws one document under its trail and heading. */
export const KnowledgeSourcePageBase = (props: KnowledgeSourcePageBaseProps) => {
    const { sourceId, ...frame } = props.props
    return (
        <KnowledgeFrame {...frame}>
            <KnowledgeSourcePanel sourceId={sourceId} />
        </KnowledgeFrame>
    )
}
