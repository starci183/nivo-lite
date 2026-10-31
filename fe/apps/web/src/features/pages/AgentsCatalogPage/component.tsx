import { Button, Page } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { AgentCatalog } from "@/components/blocks/AgentCatalog"

/** Copy and slots of the agent catalogue page. */
export interface AgentsCatalogPageBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly title: string
        readonly description: string
        /** "+ Create agent": leads to the roles to add. */
        readonly createLabel: string
        readonly createHref: string
    }
}

/** Draws the catalogue page: one Page, the trail, heading and the create action in its header, the catalogue block as its body. */
export const AgentsCatalogPageBase = (props: AgentsCatalogPageBaseProps) => (
    <Page
        measure="product"
        header={{
            title: props.props.title,
            description: props.props.description,
            breadcrumbs: { label: props.props.crumbLabel, items: props.props.crumbs },
            actions: (
                <Button intent="commit" href={props.props.createHref}>
                    {props.props.createLabel}
                </Button>
            ),
        }}
    >
        <AgentCatalog />
    </Page>
)
