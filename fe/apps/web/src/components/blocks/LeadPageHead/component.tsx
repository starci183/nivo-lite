import { Page } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import type { ReactNode } from "react"

/** The page body, the header slots and the trail of the lead page. */
export interface LeadPageHeadBaseProps {
    /** The page body under the head, and the connected slots of the head the page composes. */
    readonly shape: {
        readonly body: ReactNode
        readonly mark: ReactNode
        readonly title: ReactNode
        readonly status: ReactNode
        readonly description: ReactNode
        readonly actions: ReactNode
    }
    readonly props: {
        readonly crumbLabel: string
        /** The trail, the lead (its name, or a skeleton while it loads) last. */
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
    }
}

/** Draws the one `Page` of the lead route: the trail, the lead's mark, name, stage and actions, and the body under them. */
export const LeadPageHeadBase = (props: LeadPageHeadBaseProps) => {
    const { body, mark, title, status, description, actions } = props.shape
    return (
        <Page
            measure="product"
            header={{
                breadcrumbs: { label: props.props.crumbLabel, items: props.props.crumbs },
                mark,
                title,
                status,
                description,
                actions,
            }}
        >
            {body}
        </Page>
    )
}
