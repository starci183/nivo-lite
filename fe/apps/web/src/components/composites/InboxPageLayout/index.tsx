import type { ReactNode } from "react"
import { Breadcrumbs, PageContainer, SectionHeader } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { HEAD_CLASS, PAGE_CLASS } from "./classNames"

/** The words and the feed block of the inbound page. */
interface InboxPageLayoutProps {
    readonly crumbLabel: string
    readonly crumbs: ReadonlyArray<BreadcrumbItem>
    readonly eyebrow: string
    readonly title: string
    readonly description: string
    readonly feed: ReactNode
}

/** The inbound page body: the heading and the feed of received inputs. */
export const InboxPageLayout = (props: InboxPageLayoutProps) => (
    <PageContainer measure="product">
        <div className={PAGE_CLASS}>
            <div className={HEAD_CLASS}>
                <Breadcrumbs label={props.crumbLabel} items={[...props.crumbs]} />
                <SectionHeader level={1} eyebrow={props.eyebrow} title={props.title} description={props.description} />
            </div>
            {props.feed}
        </div>
    </PageContainer>
)
