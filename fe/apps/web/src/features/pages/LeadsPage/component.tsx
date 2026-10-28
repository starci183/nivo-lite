import { Button, Page } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { LeadCreateForm } from "@/components/blocks/LeadCreateForm"
import { LeadsBoard } from "@/components/blocks/LeadsBoard"
import { PromoChatbotCard } from "@/components/blocks/PromoChatbotCard"
import { LeadsPageLayout } from "@/components/composites/LeadsPageLayout"

/** What the Leads page opens with. */
export interface LeadsPageBaseProps {
    readonly props: {
        /** The search the page was opened with. */
        readonly query: string
        /** The new-lead form is open: the heading offers no second way in. */
        readonly isFormOpen: boolean
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly title: string
        readonly description: string
        readonly newLeadLabel: string
        readonly newLeadHref: string
    }
}

/** Draws the Leads page: the heading (the trail, the title and the one primary command, a new lead), the optional new-lead form, the board and the Chatbot promo. */
export const LeadsPageBase = (props: LeadsPageBaseProps) => {
    const p = props.props
    return (
        <Page
            measure="product"
            header={{
                breadcrumbs: { label: p.crumbLabel, items: p.crumbs },
                title: p.title,
                description: p.description,
                actions: p.isFormOpen ? undefined : (
                    <Button intent="commit" href={p.newLeadHref}>
                        {p.newLeadLabel}
                    </Button>
                ),
            }}
        >
            <LeadsPageLayout
                form={p.isFormOpen ? <LeadCreateForm /> : null}
                board={<LeadsBoard initialQuery={p.query} />}
                promo={<PromoChatbotCard variant="row" />}
            />
        </Page>
    )
}
