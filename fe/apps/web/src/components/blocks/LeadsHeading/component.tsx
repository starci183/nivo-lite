import { Breadcrumbs, Button, SectionHeader } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { HEAD_CLASS_NAME } from "./classNames"

/** The words of the Leads page heading. */
export interface LeadsHeadingBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly eyebrow: string
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
        <div className={HEAD_CLASS_NAME}>
            <Breadcrumbs label={p.crumbLabel} items={p.crumbs} />
            <SectionHeader
                level={1}
                eyebrow={p.eyebrow}
                title={p.title}
                description={p.description}
                action={
                    p.isFormOpen ? undefined : (
                        <Button variant="primary" href={p.newLeadHref}>
                            {p.newLeadLabel}
                        </Button>
                    )
                }
            />
        </div>
    )
}
