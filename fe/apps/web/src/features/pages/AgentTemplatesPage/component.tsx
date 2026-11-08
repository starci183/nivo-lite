import { Page, type BreadcrumbItem, type PageHeaderContent } from "@starci/grammar/common"
import type { ReactElement } from "react"
import { AgentMarketplace } from "@/components/blocks/AgentMarketplace"
import { AgentTemplatePackage } from "@/components/blocks/AgentTemplatePackage"
import { AgentTemplatesHub } from "@/components/blocks/AgentTemplatesHub"

/** Which of the three views of the agent templates the route shows. */
export type AgentTemplatesView = "templates" | "marketplace" | "package"

/** Copy of the agent templates page and the view it draws. */
export interface AgentTemplatesPageBaseProps {
    readonly props: {
        readonly view: AgentTemplatesView
        /** The installation whose agent is packaged, for the packaging view. */
        readonly installationId: string
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly title: string
        readonly description: string
        /** The tab line of the two list views (marketplace, my templates); null for the packaging view. */
        readonly tabs: NonNullable<PageHeaderContent["tabs"]> | null
    }
}

/** The block of one view. */
const BodyOf = (props: AgentTemplatesPageBaseProps["props"]): ReactElement => {
    if (props.view === "marketplace") return <AgentMarketplace />
    if (props.view === "package") return <AgentTemplatePackage installationId={props.installationId} />
    return <AgentTemplatesHub />
}

/** Draws the agent templates page: one Page with its trail and heading, the connected block of the view as its body. */
export const AgentTemplatesPageBase = (props: AgentTemplatesPageBaseProps): ReactElement => (
    <Page
        measure="product"
        header={{
            title: props.props.title,
            description: props.props.description,
            breadcrumbs: { label: props.props.crumbLabel, items: props.props.crumbs },
            ...(props.props.tabs === null ? {} : { tabs: props.props.tabs }),
        }}
    >
        <BodyOf {...props.props} />
    </Page>
)
