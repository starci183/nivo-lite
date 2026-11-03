import { Page } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { AgentTemplatesHub } from "@/components/blocks/AgentTemplatesHub"

/** Copy of the AgentTemplates page. */
export interface AgentTemplatesPageBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly title: string
        readonly description: string
    }
}

/** Draws the AgentTemplates page: one Page with its trail and heading, the connected block as its body. */
export const AgentTemplatesPageBase = (props: AgentTemplatesPageBaseProps) => (
    <Page
        measure="product"
        header={{
            title: props.props.title,
            description: props.props.description,
            breadcrumbs: { label: props.props.crumbLabel, items: props.props.crumbs },
        }}
    >
        <AgentTemplatesHub />
    </Page>
)
