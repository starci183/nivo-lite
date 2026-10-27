import { PageContainer } from "@starci/grammar/common"
import { KnowledgeFrame } from "@/components/blocks/KnowledgeFrame"
import { KnowledgeNivo } from "@/components/blocks/KnowledgeNivo"
import { PAGE_CLASS_NAME } from "./classNames"

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
    <PageContainer measure="product">
        <div className={PAGE_CLASS_NAME}>
            <KnowledgeFrame {...props.props} />
            <KnowledgeNivo />
        </div>
    </PageContainer>
)
