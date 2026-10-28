import type { ReactNode } from "react"
import { Page } from "@starci/grammar/common"
import type { PageHeaderContent } from "@starci/grammar/common"

/** The header, with the tabs of the Second Brain, and the body of its page. */
export interface BrainPageFrameBaseProps {
    /** The page body, drawn under the header band. */
    readonly shape: { readonly body: ReactNode }
    readonly props: { readonly header: PageHeaderContent }
}

/** Draws the Second Brain page: its header band with the tabs (sources, review, facts, lessons, questions, what each agent sees), then the body. */
export const BrainPageFrameBase = (props: BrainPageFrameBaseProps) => (
    <Page header={props.props.header} measure="product">
        {props.shape.body}
    </Page>
)
