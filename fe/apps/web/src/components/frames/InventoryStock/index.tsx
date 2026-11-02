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

type StockRowView = InventoryStockData["rows"][number]
import { InventoryNotices } from "@/components/leaves/InventoryNotices"
import {
    Button,
    ButtonGroup,
    Cluster,
    EmptyNotice,
    FilterButtonGroup,
    Section,
    Stack,
    Text,
    type ListRowData,
} from "@starci/grammar/common"
import { InventoryAdjustDrawer } from "@/components/composites/InventoryAdjustDrawer"
import { InventoryItemDrawer } from "@/components/composites/InventoryItemDrawer"

/** The stock tab: every item with its level, quick plus and minus buttons, and the forms that change it. */
export const InventoryStock = (props: InventoryStockProps) => {
    const on = {
        filter: props.onFilter,
        toggleInactive: props.onToggleInactive,
        itemField: props.onItemField,
        itemSave: props.onItemSave,
        itemToggle: props.onItemToggle,
        itemClose: props.onItemClose,
        adjustMode: props.onAdjustMode,
        adjustFrom: props.onAdjustFrom,
        adjustTo: props.onAdjustTo,
        adjustValue: props.onAdjustValue,
        adjustReason: props.onAdjustReason,
        adjustSubmit: props.onAdjustSubmit,
        adjustClose: props.onAdjustClose,
    }
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
                kind="list"
                title={props.listLabel}
                count={props.rows.length}
                items={props.rows.map((row) => itemOf(row, props))}
                empty={<EmptyNotice message={props.emptyTitle} description={props.emptyBody} />}
                filter={
                    <FilterButtonGroup
                        isLoading={props.isLoading}
                        label={props.filterLabel}
                        options={props.filters}
                        value={props.filter}
                        onValueChange={on.filter}
                    />
                }
                action={
                    props.toggleInactiveLabel === null ? undefined : (
                        <Button isLoading={props.isLoading} intent="neutral" size="sm" onPress={on.toggleInactive}>
                            {props.toggleInactiveLabel}
                        </Button>
                    )
                }
            />
            {props.itemDrawer === null ? null : (
                <InventoryItemDrawer
                    props={props.itemDrawer}
                    on={{ field: on.itemField, save: on.itemSave, toggleActive: on.itemToggle, close: on.itemClose }}
                />
            )}
            {props.adjustDrawer === null ? null : (
                <InventoryAdjustDrawer
                    props={props.adjustDrawer}
                    on={{
                        mode: on.adjustMode,
                        from: on.adjustFrom,
                        to: on.adjustTo,
                        value: on.adjustValue,
                        reason: on.adjustReason,
                        submit: on.adjustSubmit,
                        close: on.adjustClose,
                    }}
                />
            )}
        </Stack>
    )
}

/** One stock row as item data: the badges hold the state, the detail keeps the total and the quick stepper, adjust is the visible action and edit sits in the menu. */
const itemOf = (row: StockRowView, props: InventoryStockProps): ListRowData => {
    const on = {
        query: props.onQuery,
        filter: props.onFilter,
        add: props.onAdd,
        draft: props.onDraft,
        quick: props.onQuick,
        adjust: props.onAdjust,
        edit: props.onEdit,
        toggleInactive: props.onToggleInactive,
        itemField: props.onItemField,
        itemSave: props.onItemSave,
        itemToggle: props.onItemToggle,
        itemClose: props.onItemClose,
        adjustMode: props.onAdjustMode,
        adjustFrom: props.onAdjustFrom,
        adjustTo: props.onAdjustTo,
        adjustValue: props.onAdjustValue,
        adjustReason: props.onAdjustReason,
        adjustSubmit: props.onAdjustSubmit,
        adjustClose: props.onAdjustClose,
    }
    return {
        id: row.id,
        title: row.name,
        description: row.detail,
        badges:
            row.onOrderLabel === null
                ? [{ label: row.statusLabel, tone: row.statusTone, isDot: true }]
                : [
                      { label: row.statusLabel, tone: row.statusTone, isDot: true },
                      { label: row.onOrderLabel, tone: "accent" as const },
                  ],
        action: { label: props.adjustLabel, intent: "neutral", press: () => on.adjust(row.id) },
        ...(props.editLabel === null
            ? {}
            : {
                  menu: {
                      label: row.name,
                      entries: [{ id: "edit", label: props.editLabel, onAction: () => on.edit(row.id) }],
                  } as const,
              }),
        detail: (
            <Cluster gap="inline">
                <Text isStrong>{row.total}</Text>
                <ButtonGroup
                    isLoading={props.isLoading}
                    label={row.stepLabel}
                    actions={[
                        {
                            id: "less",
                            label: row.lessLabel,
                            intent: "neutral",
                            isDisabled: props.isPending,
                            onPress: () => on.quick(row.id, -1),
                        },
                        {
                            id: "more",
                            label: row.moreLabel,
                            intent: "neutral",
                            isDisabled: props.isPending,
                            onPress: () => on.quick(row.id, 1),
                        },
                    ]}
                />
            </Cluster>
        ),
    }
}
