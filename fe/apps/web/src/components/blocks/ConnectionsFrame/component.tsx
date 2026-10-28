import { Page } from "@starci/grammar/common"
import type { PageHeaderContent } from "@starci/grammar/common"
import type { ReactNode } from "react"

/** The header of the Connections page and the body drawn under it. */
export interface ConnectionsFrameBaseProps {
    /** The page body, drawn under the header band. */
    readonly shape: { readonly body: ReactNode }
    readonly props: { readonly header: PageHeaderContent }
}

/** Draws the Connections page: its header band with the trail, heading, summary, add command and tabs, then the body. */
export const ConnectionsFrameBase = (props: ConnectionsFrameBaseProps) => (
    <Page header={props.props.header} measure="product">
        {props.shape.body}
    </Page>
)
