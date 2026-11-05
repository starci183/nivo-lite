import type { InventoryStockData, InventoryStockActions } from "@/modules/types"
import { InventoryStockControls } from "@/components/composites/InventoryStockControls"

/** Resolved stock fields and atomic commands; the module Base owns read status. */
type InventoryStockProps = InventoryStockData & {
    readonly isLoading: boolean
    readonly onQuery: InventoryStockActions["onQuery"]
    readonly onFilter: InventoryStockActions["onFilter"]
    readonly onAdd: InventoryStockActions["onAdd"]
    readonly onDraft: InventoryStockActions["onDraft"]
    readonly onQuick: InventoryStockActions["onQuick"]
    readonly onAdjust: InventoryStockActions["onAdjust"]
    readonly onEdit: InventoryStockActions["onEdit"]
    readonly onToggleInactive: InventoryStockActions["onToggleInactive"]
    readonly onItemField: InventoryStockActions["onItemField"]
    readonly onItemSave: InventoryStockActions["onItemSave"]
    readonly onItemToggle: InventoryStockActions["onItemToggle"]
    readonly onItemClose: InventoryStockActions["onItemClose"]
    readonly onAdjustMode: InventoryStockActions["onAdjustMode"]
    readonly onAdjustFrom: InventoryStockActions["onAdjustFrom"]
    readonly onAdjustTo: InventoryStockActions["onAdjustTo"]
    readonly onAdjustValue: InventoryStockActions["onAdjustValue"]
    readonly onAdjustReason: InventoryStockActions["onAdjustReason"]
    readonly onAdjustSubmit: InventoryStockActions["onAdjustSubmit"]
    readonly onAdjustClose: InventoryStockActions["onAdjustClose"]
}

import { InventoryNotices } from "@/components/leaves/InventoryNotices"
import { Button, Section, Stack, Tabs } from "@starci/grammar/common"
import { InventoryStockTable } from "@/components/composites/InventoryStockTable"
import { InventoryAdjustDrawer } from "@/components/composites/InventoryAdjustDrawer"
import { InventoryItemDrawer } from "@/components/composites/InventoryItemDrawer"

/** The stock tab: every item with its level, quick plus and minus buttons, and the forms that change it. */
export const InventoryStock = (props: InventoryStockProps) => {
    return (
        <Stack gap="row">
            <InventoryStockControls
                searchLabel={props.searchLabel}
                searchPlaceholder={props.searchPlaceholder}
                clearLabel={props.clearLabel}
                addLabel={props.addLabel}
                draftLabel={props.draftLabel}
                query={props.query}
                isPending={props.isPending}
                isLoading={props.isLoading}
                onQuery={props.onQuery}
                onAdd={props.onAdd}
                onDraft={props.onDraft}
            />
            <InventoryNotices error={props.error} notice={props.notice} />
            <Section
                isLoading={props.isLoading}
                title={props.listLabel}
                count={props.rows.length}
                action={
                    props.toggleInactiveLabel === null ? undefined : (
                        <Button isLoading={props.isLoading} intent="neutral" size="sm" onPress={props.onToggleInactive}>
                            {props.toggleInactiveLabel}
                        </Button>
                    )
                }
            >
                <Tabs
                    kind="filter"
                    label={props.filterLabel}
                    items={props.filters.map((filter) => ({ id: filter.value, label: filter.label }))}
                    selectedKey={props.filter}
                    onSelect={props.onFilter}
                />
                <InventoryStockTable
                    isLoading={props.isLoading}
                    label={props.listLabel}
                    columns={props.columns}
                    rows={props.rows}
                    emptyTitle={props.emptyTitle}
                    emptyBody={props.emptyBody}
                    adjustLabel={props.adjustLabel}
                    editLabel={props.editLabel}
                    isPending={props.isPending}
                    on={{ quick: props.onQuick, adjust: props.onAdjust, edit: props.onEdit }}
                />
            </Section>
            {props.itemDrawer === null ? null : (
                <InventoryItemDrawer
                    props={props.itemDrawer}
                    on={{
                        field: props.onItemField,
                        save: props.onItemSave,
                        toggleActive: props.onItemToggle,
                        close: props.onItemClose,
                    }}
                />
            )}
            {props.adjustDrawer === null ? null : (
                <InventoryAdjustDrawer
                    props={props.adjustDrawer}
                    on={{
                        mode: props.onAdjustMode,
                        from: props.onAdjustFrom,
                        to: props.onAdjustTo,
                        value: props.onAdjustValue,
                        reason: props.onAdjustReason,
                        submit: props.onAdjustSubmit,
                        close: props.onAdjustClose,
                    }}
                />
            )}
        </Stack>
    )
}
