import { InventoryNotices } from "@/components/leaves/InventoryNotices"
import { Button, EmptyNotice, Input, ListItem, SearchField, SurfaceListCard, Text } from "@starci/grammar/common"
import { COUNT_FIELD_CLASS_NAME, COUNT_ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME, STACK_CLASS_NAME } from "./classNames"

/** One item to count, every word already resolved. */
export interface CountRowView {
    readonly id: string
    readonly name: string
    readonly machine: string
    readonly fieldLabel: string
    readonly unit: string
    readonly value: string
}

/** The words and data of the stock count tab. */
export interface InventoryCountBaseProps {
    readonly props: {
        readonly intro: string
        readonly searchLabel: string
        readonly searchPlaceholder: string
        readonly clearLabel: string
        readonly listLabel: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly submitLabel: string
        readonly query: string
        readonly rows: ReadonlyArray<CountRowView>
        readonly canSubmit: boolean
        readonly isPending: boolean
        readonly error: string | null
        readonly notice: string | null
    }
    readonly on: {
        readonly query: (value: string) => void
        readonly count: (id: string, value: string) => void
        readonly submit: () => void
    }
}

/** The stock count tab, made for a phone: type what was counted, leave the rest blank. */
export const InventoryCountBase = (props: InventoryCountBaseProps) => {
    const { props: p, on } = props
    return (
        <div className={STACK_CLASS_NAME}>
            <Text size="sm" tone="muted">
                {p.intro}
            </Text>
            <SearchField
                label={p.searchLabel}
                isLabelHidden
                placeholder={p.searchPlaceholder}
                clearLabel={p.clearLabel}
                value={p.query}
                onValueChange={on.query}
                onClear={() => on.query("")}
            />
            <SurfaceListCard
                ariaLabel={p.listLabel}
                empty={<EmptyNotice message={p.emptyTitle} description={p.emptyBody} />}
            >
                {p.rows.map((row) => (
                    <ListItem key={row.id} className={COUNT_ROW_CLASS_NAME}>
                        <div className={ROW_MAIN_CLASS_NAME}>
                            <Text weight="semibold" overflow="clamp-2">
                                {row.name}
                            </Text>
                            <Text size="xs" tone="muted">
                                {row.machine}
                            </Text>
                        </div>
                        <div className={COUNT_FIELD_CLASS_NAME}>
                            <Input
                                id={`cnt-${row.id}`}
                                name={`cnt-${row.id}`}
                                label={row.fieldLabel}
                                variant="secondary"
                                placeholder={row.unit}
                                value={row.value}
                                onValueChange={(value) => on.count(row.id, value)}
                            />
                        </div>
                    </ListItem>
                ))}
            </SurfaceListCard>
            <InventoryNotices error={p.error} notice={p.notice} />
            <div>
                <Button variant="primary" isPending={p.isPending} isDisabled={!p.canSubmit} onPress={on.submit}>
                    {p.submitLabel}
                </Button>
            </div>
        </div>
    )
}
