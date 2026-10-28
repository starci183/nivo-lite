import { Button, PageHeader } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"

/** The words of the Leads page heading. */
export interface LeadsHeadingBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly title: string
        readonly description: string
        readonly newLeadLabel: string
        readonly newLeadHref: string
        /** True while the new-lead form is open: the heading offers no second way in. */
        readonly isFormOpen: boolean
    }
}

/** The Leads page heading: the trail, the title and the one primary command, a new lead. */
export const LeadsHeadingBase = (props: LeadsHeadingBaseProps) => {
    const { props: p } = props
    return (
        <PageHeader
            measure="product"
            breadcrumbs={{ label: p.crumbLabel, items: p.crumbs }}
            title={p.title}
            description={p.description}
            actions={
                p.isFormOpen ? undefined : (
                    <Button intent="commit" href={p.newLeadHref}>
                        {p.newLeadLabel}
                    </Button>
                )
            }
        />
    )
}
