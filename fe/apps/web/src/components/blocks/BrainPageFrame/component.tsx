import type { ReactNode } from "react"
import { Page } from "@starci/grammar/common"
import type { PageHeaderContent } from "@starci/grammar/common"

/** The header, with the tabs of the Second Brain, and the body of its page. */
export interface BrainPageFrameBaseProps {
    /** The page body, drawn under the header band. */
    readonly shape: { readonly body: ReactNode }
    readonly props: {
        readonly header: PageHeaderContent
        /** The body is an app surface that fills the region edge to edge (the dossiers); otherwise it sits in the page measure and gutter. */
        readonly isBleed: boolean
    }
}

/** Draws the Second Brain page: its header band with the tabs (dossiers, sources, review, facts, lessons, questions, what each agent sees), then the body. */
export const BrainPageFrameBase = (props: BrainPageFrameBaseProps) =>
    props.props.isBleed ? (
        <Page chrome="bleed" header={props.props.header} measure="product">
            {props.shape.body}
        </Page>
    ) : (
        <Page header={props.props.header} measure="product">
            {props.shape.body}
        </Page>
    )
