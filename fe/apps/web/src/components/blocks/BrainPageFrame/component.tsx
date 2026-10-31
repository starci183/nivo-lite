import type { ReactNode } from "react"
import { Page } from "@starci/grammar/common"
import type { PageHeaderContent } from "@starci/grammar/common"

/** The header, with the tabs of the Second Brain, and the body of its page. */
export interface BrainPageFrameBaseProps {
    /** The page body, drawn under the header band in the page measure and gutter. */
    readonly shape: { readonly body: ReactNode }
    readonly props: {
        readonly header: PageHeaderContent
    }
}

/**
 * Draws a Second Brain page whose tab sits in the page measure (sources, review, facts, lessons, questions, what each agent
 * sees): its header band with the tabs, then the body. The dossiers tab is panes and draws its own panes page.
 */
export const BrainPageFrameBase = (props: BrainPageFrameBaseProps) => (
    <Page header={props.props.header} measure="product">
        {props.shape.body}
    </Page>
)
