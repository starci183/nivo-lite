import { Page } from "@starci/grammar/common"
import type { PageHeaderContent } from "@starci/grammar/common"
import { KnowledgeSourcePanel } from "@/components/blocks/KnowledgeSourcePanel"
import { PAGE_CLASS_NAME } from "./classNames"

/** The header and the document the document page supplies. */
export interface KnowledgeSourcePageBaseProps {
    readonly props: {
        readonly header: PageHeaderContent
        /** The document of the address; undefined while the page only shows its skeleton. */
        readonly sourceId: string | undefined
    }
}

/** Draws one document under its trail and heading. */
export const KnowledgeSourcePageBase = (props: KnowledgeSourcePageBaseProps) => (
    <Page header={props.props.header} measure="product">
        <div className={PAGE_CLASS_NAME}>
            <KnowledgeSourcePanel sourceId={props.props.sourceId} />
        </div>
    </Page>
)
