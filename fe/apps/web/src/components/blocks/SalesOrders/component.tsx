import { Badge, Button, ListRow, SurfaceCard, SurfaceListCard, Text, TextAction } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { STACK_CLASS_NAME } from "./classNames"

/** One order in the history with its display text resolved. */
export interface SalesOrderRowView {
    readonly id: string
    readonly number: string
    readonly items: string
    readonly leadHref: string | null
    readonly status: string
    readonly amount: string
    readonly createdAt: string
}

/** The order history's display state and page actions. */
export interface SalesOrdersBaseProps {
    readonly props: {
        readonly title: string
        readonly slot: DataSlot<ReadonlyArray<SalesOrderRowView>>
        readonly slotLabels: SlotLabels
        readonly hasNextPage: boolean
        readonly isLoadingMore: boolean
        readonly paginationFailure: string | null
        readonly loadMoreLabel: string
        readonly retryLabel: string
    }
    readonly on: {
        readonly loadMore: () => void
        readonly retry: () => void
    }
}

const PLACEHOLDER: ReadonlyArray<SalesOrderRowView> = [
    { id: "loading", number: "", items: "", leadHref: null, status: "", amount: "", createdAt: "" },
]

/** Order records remain visible while the next page is loading or waiting for a retry. */
export const SalesOrdersBase = (props: SalesOrdersBaseProps) => {
    const { props: p, on } = props
    return (
        <SurfaceCard label={p.title} headingLevel={2}>
            <div className={STACK_CLASS_NAME}>
                <SlotView slot={p.slot} placeholder={PLACEHOLDER} labels={p.slotLabels} onRetry={on.retry}>
                    {(rows, isSkeleton) => (
                        <SurfaceListCard ariaLabel={p.title} isLoading={isSkeleton}>
                            {rows.map((row) => (
                                <ListRow
                                    key={row.id}
                                    title={
                                        row.leadHref === null ? (
                                            row.number
                                        ) : (
                                            <TextAction href={row.leadHref}>{row.number}</TextAction>
                                        )
                                    }
                                    description={row.items}
                                    badges={<Badge tone="neutral">{row.status}</Badge>}
                                >
                                    <Text size="sm" weight="medium">
                                        {row.amount}
                                    </Text>
                                    <Text size="xs" tone="muted">
                                        {row.createdAt}
                                    </Text>
                                </ListRow>
                            ))}
                        </SurfaceListCard>
                    )}
                </SlotView>
                {p.paginationFailure === null ? null : (
                    <Text size="sm" live="polite">
                        {p.paginationFailure}
                    </Text>
                )}
                {p.hasNextPage || p.paginationFailure !== null ? (
                    <Button
                        intent="neutral"
                        size="sm"
                        isPending={p.isLoadingMore}
                        isDisabled={p.isLoadingMore}
                        onPress={p.paginationFailure === null ? on.loadMore : on.retry}
                    >
                        {p.paginationFailure === null ? p.loadMoreLabel : p.retryLabel}
                    </Button>
                ) : null}
            </div>
        </SurfaceCard>
    )
}
