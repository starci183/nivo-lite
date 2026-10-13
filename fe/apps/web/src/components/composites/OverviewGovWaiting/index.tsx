import { Badge, SectionHeader, SurfaceCard, Text, TextAction } from "@starci/grammar/common"
import { AccountingBlock } from "@/components/branches/AccountingBlock"
import type { GovWaitingItem } from "@/hooks/overviewGov"
import { STACK_CLASS_NAME, TILE_COPY_CLASS_NAME, WAIT_LIST_CLASS_NAME, CHIP_ROW_CLASS_NAME } from "./classNames"

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

/** The decisions waiting for the owner: the oldest few, each opening Office. */
export const OverviewGovWaiting = (props: OverviewGovWaitingProps) => {
    const cards = props.figures.items.map((item) => ({
        item,
        action: { kind: "link" as const, href: props.figures.chatHref, label: item.title },
    }))
    return (
        <AccountingBlock label={props.figures.title}>
            <SectionHeader
                level={2}
                title={props.figures.title}
                action={
                    props.figures.openLabel === null ? undefined : (
                        <TextAction href={props.figures.chatHref} appearance="section">
                            {props.figures.openLabel}
                        </TextAction>
                    )
                }
            />
            <SurfaceCard ariaLabel={props.figures.title}>
                <div className={STACK_CLASS_NAME}>
                    {props.figures.items.length === 0 ? (
                        <Text tone="muted">{props.figures.none}</Text>
                    ) : (
                        <>
                            <Text weight="semibold">{props.figures.count}</Text>
                            <div className={WAIT_LIST_CLASS_NAME}>
                                {cards.map(({ item, action }) => (
                                    <SurfaceCard key={item.id} depth="nested" wholeAction={action}>
                                        <div className={TILE_COPY_CLASS_NAME}>
                                            <div className={CHIP_ROW_CLASS_NAME}>
                                                <Badge tone="neutral">{item.department}</Badge>
                                                {item.reason === null ? null : (
                                                    <Badge tone="warning">{item.reason}</Badge>
                                                )}
                                            </div>
                                            <Text size="sm" weight="medium">
                                                {item.title}
                                            </Text>
                                            {item.summary === null ? null : (
                                                <Text size="sm" tone="muted" overflow="clamp-2">
                                                    {item.summary}
                                                </Text>
                                            )}
                                        </div>
                                    </SurfaceCard>
                                ))}
                            </div>
                            {props.figures.more === null ? null : (
                                <Text size="sm" tone="muted">
                                    {props.figures.more}
                                </Text>
                            )}
                        </>
                    )}
                    <Text size="xs" tone="muted">
                        {props.figures.source}
                    </Text>
                </div>
            </SurfaceCard>
        </AccountingBlock>
    )
}
