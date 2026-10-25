import { InventoryNotices } from "@/components/leaves/InventoryNotices"
import { Button, ListRow, SectionHeader, SurfaceCard, SurfaceListCard, Text } from "@starci/grammar/common"
import { QUOTE_CLASS_NAME, ACTIONS_CLASS_NAME, STACK_CLASS_NAME } from "./classNames"

/** One decision that waits for the owner, every word already resolved. */
export interface PendingRowView {
    readonly id: string
    readonly summary: string
    readonly draft: string | null
    readonly approveLabel: string
}

/** The words and data of the waiting decisions. */
export interface InventoryPendingBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly count: number
        readonly rejectLabel: string
        readonly rows: ReadonlyArray<PendingRowView>
        readonly isPending: boolean
        readonly error: string | null
    }
    readonly on: {
        readonly approve: (id: string) => void
        readonly reject: (id: string) => void
    }
}

/** What waits for the owner: sending an order to a supplier and bigger stock changes. */
export const InventoryPendingBase = (props: InventoryPendingBaseProps) => {
    const { props: p, on } = props
    if (p.rows.length === 0) return null
    return (
        <div className={STACK_CLASS_NAME}>
            <SectionHeader level={2} title={p.title} count={p.count} description={p.description} />
            <InventoryNotices error={p.error} />
            <SurfaceListCard ariaLabel={p.title}>
                {p.rows.map((row) => (
                    <ListRow
                        key={row.id}
                        title={row.summary}
                        actions={
                            <div className={ACTIONS_CLASS_NAME}>
                                <Button
                                    intent="alternative"
                                    size="sm"
                                    isDisabled={p.isPending}
                                    onPress={() => on.approve(row.id)}
                                >
                                    {row.approveLabel}
                                </Button>
                                <Button
                                    intent="alternative"
                                    size="sm"
                                    isDisabled={p.isPending}
                                    onPress={() => on.reject(row.id)}
                                >
                                    {p.rejectLabel}
                                </Button>
                            </div>
                        }
                    >
                        {row.draft === null ? null : (
                            <SurfaceCard ariaLabel={row.summary}>
                                <div className={QUOTE_CLASS_NAME}>
                                    <Text size="sm">{row.draft}</Text>
                                </div>
                            </SurfaceCard>
                        )}
                    </ListRow>
                ))}
            </SurfaceListCard>
        </div>
    )
}
