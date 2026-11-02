import type { InventoryHistoryData, InventoryHistoryActions } from "@/modules/types"

/** Resolved history fields and atomic commands; the module Base owns read status. */
type InventoryHistoryProps = InventoryHistoryData & {
    readonly isLoading: boolean
    readonly onQuery: InventoryHistoryActions["onQuery"]
    readonly onKind: InventoryHistoryActions["onKind"]
}
import { EmptyNotice, FilterButtonGroup, SearchField, Section, Stack, Text } from "@starci/grammar/common"

/** The searchable movement history, with its peer filter and evidence in each row's detail. */
export const InventoryHistory = (props: InventoryHistoryProps) => {
    const on = { query: props.onQuery, kind: props.onKind }
    return (
        <Section
            isLoading={props.isLoading}
            kind="list"
            title={props.listLabel}
            filter={
                <Stack gap="row">
                    <SearchField
                        isLoading={props.isLoading}
                        label={props.searchLabel}
                        isLabelHidden
                        placeholder={props.searchPlaceholder}
                        clearLabel={props.clearLabel}
                        value={props.query}
                        onValueChange={on.query}
                        onClear={() => on.query("")}
                    />
                    <FilterButtonGroup
                        isLoading={props.isLoading}
                        label={props.kindLabel}
                        options={props.kinds}
                        value={props.kind}
                        onValueChange={on.kind}
                    />
                </Stack>
            }
            items={props.rows.map((row) => ({
                id: row.id,
                title: `${row.itemName} ${row.quantity}`,
                badges: [{ label: row.kindLabel, tone: row.kindTone }],
                description: row.detail,
                detail: (
                    <Stack gap="row">
                        <Text size="xs" tone="muted">
                            {row.stamp}
                        </Text>
                        {row.evidence === null ? null : (
                            <Text size="xs" tone="muted" overflow="clamp-2">
                                {row.evidence}
                            </Text>
                        )}
                    </Stack>
                ),
            }))}
            empty={<EmptyNotice message={props.emptyTitle} description={props.emptyBody} />}
        />
    )
}
