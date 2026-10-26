import { Breadcrumbs, PageContainer, SectionHeader } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { AgentCatalog } from "@/components/blocks/AgentCatalog"
import { HEAD, REGIONS } from "./classNames"

/** Copy and slots of the agent catalogue page. */
export interface AgentsCatalogPageBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly title: string
        readonly description: string
    }
}

/** Draws the catalogue page: the trail, the heading and the catalogue block. */
export const AgentsCatalogPageBase = (props: AgentsCatalogPageBaseProps) => (
    <PageContainer measure="product">
        <div className={REGIONS}>
            <div className={HEAD}>
                <Breadcrumbs label={props.props.crumbLabel} items={props.props.crumbs} />
                <SectionHeader level={1} title={props.props.title} description={props.props.description} />
            </div>
            <AgentCatalog />
        </div>
    </PageContainer>
)
