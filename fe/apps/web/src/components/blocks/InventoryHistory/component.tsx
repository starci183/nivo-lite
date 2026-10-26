import {
    Badge,
    EmptyNotice,
    ListRow,
    SearchField,
    SegmentedControl,
    SurfaceListCard,
    Text,
} from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { STACK_CLASS_NAME, TOOLBAR_CLASS_NAME, TOOLBAR_FIELD_CLASS_NAME } from "./classNames"

/** One stock movement, every word already resolved. */
export interface MovementRowView {
    readonly id: string
    readonly kindLabel: string
    readonly kindTone: BadgeTone
    readonly itemName: string
    readonly quantity: string
    readonly detail: string
    readonly evidence: string | null
    readonly stamp: string
}

/** The words and data of the movement history. */
export interface InventoryHistoryBaseProps {
    readonly props: {
        readonly searchLabel: string
        readonly searchPlaceholder: string
        readonly clearLabel: string
        readonly kindLabel: string
        readonly kinds: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly listLabel: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly query: string
        readonly kind: string
        readonly rows: ReadonlyArray<MovementRowView>
    }
    readonly on: {
        readonly query: (value: string) => void
        readonly kind: (value: string) => void
    }
}

/** The history of stock movements: who changed which quantity, why, and what it left behind. */
export const InventoryHistoryBase = (props: InventoryHistoryBaseProps) => {
    const { props: p, on } = props
    return (
        <div className={STACK_CLASS_NAME}>
            <div className={TOOLBAR_CLASS_NAME}>
                <div className={TOOLBAR_FIELD_CLASS_NAME}>
                    <SearchField
                        label={p.searchLabel}
                        isLabelHidden
                        placeholder={p.searchPlaceholder}
                        clearLabel={p.clearLabel}
                        value={p.query}
                        onValueChange={on.query}
                        onClear={() => on.query("")}
                    />
                </div>
                <SegmentedControl
                    label={p.kindLabel}
                    isLabelHidden
                    options={p.kinds}
                    value={p.kind}
                    onValueChange={on.kind}
                />
            </div>
            <SurfaceListCard
                ariaLabel={p.listLabel}
                empty={<EmptyNotice message={p.emptyTitle} description={p.emptyBody} />}
            >
                {p.rows.map((row) => (
                    <ListRow
                        key={row.id}
                        title={`${row.itemName} ${row.quantity}`}
                        badges={<Badge tone={row.kindTone}>{row.kindLabel}</Badge>}
                        description={row.detail}
                        actions={
                            <Text size="xs" tone="muted">
                                {row.stamp}
                            </Text>
                        }
                    >
                        {row.evidence === null ? null : (
                            <Text size="xs" tone="muted" overflow="clamp-2">
                                {row.evidence}
                            </Text>
                        )}
                    </ListRow>
                ))}
            </SurfaceListCard>
        </div>
    )
}
