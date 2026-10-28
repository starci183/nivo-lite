import type { ReactNode } from "react"
import { Button, Page } from "@starci/grammar/common"
import { pageHeadingOf } from "@/modules/page-header"
import { PAGE_CLASS_NAME } from "./classNames"

interface CreditsLayoutBaseProps {
    readonly children: ReactNode
    readonly props: {
        readonly title: string
        readonly description: string
        readonly history: string
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<{ readonly id: string; readonly label: string; readonly href?: string }>
    }
}

/** Draws the static credits page: its header, then the independently connected slots. */
export const CreditsLayoutBase = (props: CreditsLayoutBaseProps) => (
    <Page
        header={pageHeadingOf({
            crumbLabel: props.props.crumbLabel,
            crumbs: props.props.crumbs,
            title: props.props.title,
            description: props.props.description,
            actions: (
                <Button intent="alternative" href="#payments">
                    {props.props.history}
                </Button>
            ),
        })}
        measure="product"
    >
        <div className={PAGE_CLASS_NAME}>{props.children}</div>
    </Page>
)
