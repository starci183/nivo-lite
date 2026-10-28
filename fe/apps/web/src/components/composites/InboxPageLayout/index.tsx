import type { ReactNode } from "react"
import { PageContainer, PageHeader } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { PAGE_CLASS } from "./classNames"

/** The words and the feed block of the inbound page. */
interface InboxPageLayoutProps {
    readonly crumbLabel: string
    readonly crumbs: ReadonlyArray<BreadcrumbItem>
    readonly eyebrow: string
    readonly title: string
    readonly description: string
    readonly feed: ReactNode
}

/** The inbound page: the header band, then the feed of received inputs. */
export const InboxPageLayout = (props: InboxPageLayoutProps) => (
    <>
        <PageHeader
            title={props.title}
            description={props.description}
            meta={props.eyebrow}
            breadcrumbs={{ label: props.crumbLabel, items: props.crumbs }}
        />
        <PageContainer measure="product">
            <div className={PAGE_CLASS}>{props.feed}</div>
        </PageContainer>
    </>
)
