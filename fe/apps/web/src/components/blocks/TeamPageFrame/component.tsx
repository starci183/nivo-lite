import type { ReactNode } from "react"
import { Page } from "@starci/grammar/common"
import type { PageHeaderContent } from "@starci/grammar/common"

/** The header and the body of a page of the team: members or permissions. */
export interface TeamPageFrameBaseProps {
    /** The header with the Thanh vien and Quyen tabs; the tabs are absent for a person who may not see both pages. */
    /** The page body, drawn under the header band. */
    readonly shape: { readonly body: ReactNode }
    readonly props: { readonly header: PageHeaderContent }
}

/** Draws the page of the team: its header band with the Thanh vien and Quyen tabs, then the body. */
export const TeamPageFrameBase = (props: TeamPageFrameBaseProps) => (
    <Page header={props.props.header} measure="product">
        {props.shape.body}
    </Page>
)
