import { Page } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { AgentTemplatePackage } from "@/components/blocks/AgentTemplatePackage"

/** Copy of the AgentPackage page. */
export interface AgentPackagePageBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly title: string
        readonly description: string
        readonly installationId: string
    }
}

/** Draws the AgentPackage page: one Page with its trail and heading, the connected block as its body. */
export const AgentPackagePageBase = (props: AgentPackagePageBaseProps) => (
    <Page
        measure="product"
        header={{
            title: props.props.title,
            description: props.props.description,
            breadcrumbs: { label: props.props.crumbLabel, items: props.props.crumbs },
        }}
    >
        <AgentTemplatePackage installationId={props.props.installationId} />
    </Page>
)
