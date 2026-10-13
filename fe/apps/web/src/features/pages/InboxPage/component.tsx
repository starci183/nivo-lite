import { Alert, Badge, Breadcrumbs, PageContainer, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { InboxFeed } from "@/components/blocks/InboxFeed"
import type { InboxEvent } from "@/components/blocks/InboxFeed"
import { InboxSimulator } from "@/components/blocks/InboxSimulator"
import { BANK_CONNECTION } from "@/lib/bank"
import { BANK_HEAD_CLASS, HEAD_CLASS, PAGE_CLASS, STACK_TIGHT_CLASS } from "./classNames"

/** Props for {@link InboxPageBase}. */
export interface InboxPageBaseProps {
    readonly props: {
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
        readonly events: ReadonlyArray<InboxEvent>
        readonly nowIso: string
        readonly initialEventId: string
        /** STATE-8: the same page while its data loads - labels, the notice and the simulator stay, the feed is skeleton rows. */
        readonly isLoading: boolean
    }
}

/** The "Đầu vào" page body: a permanent simulated-channels notice, the inbound simulator and the feed of received inputs. */
export const InboxPageBase = ({ props }: InboxPageBaseProps) => (
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
                        <Text weight="semibold">{BANK_CONNECTION.name}</Text>
                        <Text tone="muted" size="sm">
                            {BANK_CONNECTION.account}
                        </Text>
                        {BANK_CONNECTION.simulated ? <Badge tone="warning">{props.bankSimulated}</Badge> : null}
                    </div>
                    <Text size="sm" tone="muted">
                        {props.bankNote}
                    </Text>
                </div>
            </SurfaceCard>
            <div inert={props.isLoading}>
                <InboxSimulator initialEventId={props.initialEventId} />
            </div>
            <InboxFeed events={props.events} nowIso={props.nowIso} isLoading={props.isLoading} />
        </div>
    </PageContainer>
)
