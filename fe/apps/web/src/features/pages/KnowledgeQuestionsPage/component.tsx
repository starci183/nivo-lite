import { Page, Stack, type PageHeaderContent } from "@starci/grammar/common"
import { DocumentQuestions } from "@/components/blocks/DocumentQuestions"
import { DocumentRelease } from "@/components/blocks/DocumentRelease"

/** The header words and the document whose questions this page shows. */
export interface KnowledgeQuestionsPageBaseProps {
    readonly props: {
        readonly header: PageHeaderContent
        /** The document of the address. */
        readonly sourceId: string
    }
}

/**
 * Draws the questions of one document as its own page (complex content is a page, never a drawer): what customers may read of the document
 * and what holds the rest, then one card per kind of doubt the critic raised, each answered with its buttons.
 */
export const KnowledgeQuestionsPageBase = (props: KnowledgeQuestionsPageBaseProps) => (
    <Page header={props.props.header} measure="product">
        <Stack gap="region">
            <DocumentRelease sourceId={props.props.sourceId} />
            <DocumentQuestions sourceId={props.props.sourceId} />
        </Stack>
    </Page>
)

/** What the loading Page is told: the real header words. */
export interface KnowledgeQuestionsLoadingPageBaseProps {
    readonly props: Pick<KnowledgeQuestionsPageBaseProps["props"], "header">
}

/** Draws the same Page while the route loads: the real header and the skeleton of both blocks, in the ready order. */
export const KnowledgeQuestionsLoadingPageBase = (props: KnowledgeQuestionsLoadingPageBaseProps) => (
    <Page header={props.props.header} measure="product" isLoading>
        <Stack gap="region">
            <DocumentRelease isLoading />
            <DocumentQuestions isLoading />
        </Stack>
    </Page>
)
