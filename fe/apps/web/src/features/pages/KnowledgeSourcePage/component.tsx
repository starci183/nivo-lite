import { Page, Stack, type PageHeaderContent } from "@starci/grammar/common"

import { KnowledgeSourcePanel } from "@/components/blocks/KnowledgeSourcePanel"

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
        <Stack gap="region">
            <KnowledgeSourcePanel sourceId={props.props.sourceId} />
        </Stack>
    </Page>
)
