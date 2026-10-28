import { Page } from "@starci/grammar/common"
import type { PageHeaderContent } from "@starci/grammar/common"
import { KnowledgeNivo } from "@/components/blocks/KnowledgeNivo"
import { PAGE_CLASS_NAME } from "./classNames"

/** The header the base knowledge page supplies. */
export interface KnowledgeNivoPageBaseProps {
    readonly props: {
        readonly header: PageHeaderContent
    }
}

/** Draws the base knowledge of NIVO under its trail and heading. */
export const KnowledgeNivoPageBase = (props: KnowledgeNivoPageBaseProps) => (
    <Page header={props.props.header} measure="product">
        <div className={PAGE_CLASS_NAME}>
            <KnowledgeNivo />
        </div>
    </Page>
)
