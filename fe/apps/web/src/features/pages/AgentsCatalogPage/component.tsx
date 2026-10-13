import { Breadcrumbs, PageContainer, SectionHeader } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { AgentCatalog } from "@/components/blocks/AgentCatalog"
import type { AgentCatalogProps } from "@/components/blocks/AgentCatalog"
import { HEAD, REGIONS } from "./classNames"

/** Copy and slots of the agent catalogue page. */
export interface AgentsCatalogPageBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly eyebrow: string
        readonly title: string
        readonly description: string
        /** What the catalogue block under the heading shows. */
        readonly catalog: AgentCatalogProps
    }
}

/** Draws the catalogue page: the trail, the heading and the catalogue block. */
export const AgentsCatalogPageBase = (props: AgentsCatalogPageBaseProps) => (
    <PageContainer measure="product">
        <div className={REGIONS}>
            <div className={HEAD}>
                <Breadcrumbs label={props.props.crumbLabel} items={props.props.crumbs} />
                <SectionHeader
                    level={1}
                    eyebrow={props.props.eyebrow}
                    title={props.props.title}
                    description={props.props.description}
                />
            </div>
            <AgentCatalog {...props.props.catalog} />
        </div>
    </PageContainer>
)
