import { KnowledgeSourcePanel } from "@/components/blocks/KnowledgeSourcePanel"
import { KnowledgeFrame } from "@/components/blocks/KnowledgeFrame"
import type { DocumentPassage, KnowledgeDocumentDetail } from "@/modules/types"

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
        readonly workspaceId: string
        readonly canWrite: boolean
        /** Null while the page loads. */
        readonly source: KnowledgeDocumentDetail | null
        readonly chunks: ReadonlyArray<DocumentPassage>
    }
}

/** Draws one document under its trail and heading. */
export const KnowledgeSourcePageBase = (props: KnowledgeSourcePageBaseProps) => (
    <KnowledgeFrame
        crumbLabel={props.props.crumbLabel}
        crumbHome={props.props.crumbHome}
        homeHref={props.props.homeHref}
        crumbBrain={props.props.crumbBrain}
        brainHref={props.props.brainHref}
        crumbDocuments={props.props.crumbDocuments}
        documentsHref={props.props.documentsHref}
        title={props.props.title}
        eyebrow={props.props.eyebrow}
        description={props.props.description}
    >
        <KnowledgeSourcePanel
            workspaceId={props.props.workspaceId}
            source={props.props.source}
            chunks={props.props.chunks}
            canWrite={props.props.canWrite}
        />
    </KnowledgeFrame>
)
