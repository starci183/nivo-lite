import { Page } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { AgentMarketplace } from "@/components/blocks/AgentMarketplace"

/** Copy of the AgentMarketplace page. */
export interface AgentMarketplacePageBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly title: string
        readonly description: string
    }
}

/** Draws the AgentMarketplace page: one Page with its trail and heading, the connected block as its body. */
export const AgentMarketplacePageBase = (props: AgentMarketplacePageBaseProps) => (
    <Page
        measure="product"
        header={{
            title: props.props.title,
            description: props.props.description,
            breadcrumbs: { label: props.props.crumbLabel, items: props.props.crumbs },
        }}
    >
        <AgentMarketplace />
    </Page>
)
