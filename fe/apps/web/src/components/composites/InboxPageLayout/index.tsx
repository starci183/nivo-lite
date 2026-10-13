import type { ReactNode } from "react"
import { Alert, Badge, Breadcrumbs, PageContainer, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { BANK_HEAD_CLASS, HEAD_CLASS, PAGE_CLASS, STACK_TIGHT_CLASS } from "./classNames"

/** The words and the two blocks of the inbound page. */
interface InboxPageLayoutProps {
    readonly crumbLabel: string
    readonly crumbs: ReadonlyArray<BreadcrumbItem>
    readonly eyebrow: string
    readonly title: string
    readonly description: string
    readonly alertTitle: string
    readonly alertBody: string
    readonly bankTitle: string
    readonly bankSimulated: string
    readonly bankNote: string
    readonly bankName: string
    readonly bankAccount: string
    /** The same page while its data loads: the labels, the notice and the simulator stay, the feed is skeleton rows. */
    readonly isLoading: boolean
    readonly simulator: ReactNode
    readonly feed: ReactNode
}

/** The inbound page body: a permanent simulated-channels notice, the inbound simulator and the feed of received inputs. */
export const InboxPageLayout = (props: InboxPageLayoutProps) => (
    <PageContainer measure="product">
        <div className={PAGE_CLASS}>
            <div className={HEAD_CLASS}>
                <Breadcrumbs label={props.crumbLabel} items={[...props.crumbs]} />
                <SectionHeader level={1} eyebrow={props.eyebrow} title={props.title} description={props.description} />
            </div>
            <Alert title={props.alertTitle} description={props.alertBody} tone="cautionary" />
            <SurfaceCard label={props.bankTitle} ariaLabel={props.bankTitle}>
                <div className={STACK_TIGHT_CLASS}>
                    <div className={BANK_HEAD_CLASS}>
                        <Text weight="semibold">{props.bankName}</Text>
                        <Text tone="muted" size="sm">
                            {props.bankAccount}
                        </Text>
                        <Badge tone="warning">{props.bankSimulated}</Badge>
                    </div>
                    <Text size="sm" tone="muted">
                        {props.bankNote}
                    </Text>
                </div>
            </SurfaceCard>
            <div inert={props.isLoading}>{props.simulator}</div>
            {props.feed}
        </div>
    </PageContainer>
)
