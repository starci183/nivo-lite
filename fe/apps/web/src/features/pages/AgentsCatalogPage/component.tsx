import { PageContainer, PageHeader } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { AgentCatalog } from "@/components/blocks/AgentCatalog"
import { REGIONS } from "./classNames"

/** Copy and slots of the agent catalogue page. */
export interface AgentsCatalogPageBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly title: string
        readonly description: string
    }
}

/** Draws the catalogue page: the header band, then the catalogue block. */
export const AgentsCatalogPageBase = (props: AgentsCatalogPageBaseProps) => (
    <>
        <PageHeader
            title={props.props.title}
            description={props.props.description}
            breadcrumbs={{ label: props.props.crumbLabel, items: props.props.crumbs }}
        />
        <PageContainer measure="product">
            <div className={REGIONS}>
                <AgentCatalog />
            </div>
        </PageContainer>
    </>
)
