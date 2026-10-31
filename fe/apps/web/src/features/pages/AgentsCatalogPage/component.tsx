import { Page } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { AgentCatalog } from "@/components/blocks/AgentCatalog"
import { AgentCreateAction } from "@/components/blocks/AgentCreateAction"
import { AgentWorkWorkspaceSwitch } from "@/components/blocks/AgentWorkWorkspaceSwitch"

/** Copy and slots of the agent catalogue page. */
export interface AgentsCatalogPageBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly title: string
        readonly description: string
    }
}

/** Draws the catalogue page: one Page, the trail, heading and the create action (for the people who may install) in its header, the catalogue block as its body. */
export const AgentsCatalogPageBase = (props: AgentsCatalogPageBaseProps) => (
    <Page
        measure="product"
        header={{
            title: props.props.title,
            description: props.props.description,
            breadcrumbs: { label: props.props.crumbLabel, items: props.props.crumbs },
            actions: <AgentCreateAction />,
        }}
    >
        <AgentWorkWorkspaceSwitch />
        <AgentCatalog />
    </Page>
)
