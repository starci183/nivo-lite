import { Link, Page } from "@starci/grammar/common"
import type { ReactNode } from "react"

/** Props for {@link AutomationsHeadingBase}. */
export interface AutomationsHeadingBaseProps {
    /** The page body, drawn under the header band. */
    readonly shape: { readonly body: ReactNode }
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<{ readonly id: string; readonly label: string; readonly href?: string }>
        /** The workspace name under the title; unknown while the page loads. */
        readonly workspace?: string
        readonly title: string
        readonly leadBefore: string
        readonly leadLink: string
        readonly leadHref: string
        readonly leadAfter: string
        /** True while the workspace name is unresolved: the header is drawn as its measured placeholder. */
        readonly isSkeleton: boolean
    }
}

/** Draws the Automations page: its header band, with the link to the authority page inside the lead, and the body. */
export const AutomationsHeadingBase = (props: AutomationsHeadingBaseProps) => {
    const p = props.props
    return (
        <Page
            measure="product"
            isSkeleton={p.isSkeleton}
            header={{
                breadcrumbs: { label: p.crumbLabel, items: p.crumbs },
                title: p.title,
                meta: p.workspace ?? "-",
                description: (
                    <>
                        {p.leadBefore}
                        <Link href={p.leadHref}>{p.leadLink}</Link>
                        {p.leadAfter}
                    </>
                ),
            }}
        >
            {props.shape.body}
        </Page>
    )
}
