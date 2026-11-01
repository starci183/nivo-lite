import { Badge, Button, EmptyNotice, ListRow, SurfaceListCard, TextAction } from "@starci/grammar/common"
import { AccountingBlock } from "@/components/branches/AccountingBlock"
import type { GovWaitingItem } from "@/hooks/overviewGov"

/** The figures of the waiting block. */
export interface OverviewGovWaitingProps {
    readonly figures: {
        readonly title: string
        readonly openLabel: string | null
        readonly chatHref: string
        readonly none: string
        readonly count: string
        readonly items: ReadonlyArray<GovWaitingItem>
        readonly more: string | null
        readonly source: string
    }
}

/** The decisions waiting for the owner: the oldest few, each opening Office, in one list with the count and the source. */
export const OverviewGovWaiting = (props: OverviewGovWaitingProps) => {
    const { figures } = props
    return (
        <AccountingBlock label={figures.title}>
            <SurfaceListCard
                label={figures.title}
                labelEnd={
                    figures.openLabel === null ? undefined : (
                        <TextAction href={figures.chatHref} appearance="section">
                            {figures.openLabel}
                        </TextAction>
                    )
                }
                {...(figures.items.length === 0 ? {} : { fact: figures.count })}
                empty={<EmptyNotice message={figures.none} />}
                footer={[figures.more ?? "", figures.source].filter((line) => line !== "").join(" · ")}
            >
                {figures.items.map((item) => (
                    <ListRow
                        key={item.id}
                        title={item.title}
                        {...(item.summary === null ? {} : { description: item.summary })}
                        badges={
                            <>
                                <Badge tone="neutral">{item.department}</Badge>
                                {item.reason === null ? null : <Badge tone="warning">{item.reason}</Badge>}
                            </>
                        }
                        actions={
                            figures.openLabel === null ? undefined : (
                                <Button size="sm" intent="neutral" href={figures.chatHref}>
                                    {figures.openLabel}
                                </Button>
                            )
                        }
                    />
                ))}
            </SurfaceListCard>
        </AccountingBlock>
    )
}
