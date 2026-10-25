import type * as React from "react"
import type { useInventoryBoard } from "@/hooks/inventoryBoard"
import type { useTranslations } from "next-intl"
import type {
    useAdjustDrawer,
    useInventoryFormat,
    useInventoryRun,
    useItemDrawer,
    StockFilter,
    ItemFormField,
} from "@/hooks/inventory"

import type { ItemView } from "@/modules/types"
import { InventoryNotices } from "@/components/leaves/InventoryNotices"
import {
    Badge,
    Button,
    EmptyNotice,
    ListRow,
    SearchField,
    SegmentedControl,
    SurfaceListCard,
    Text,
    type BadgeTone,
} from "@starci/grammar/common"

import { InventoryAdjustDrawer, type InventoryAdjustDrawerProps } from "@/components/composites/InventoryAdjustDrawer"

import { InventoryItemDrawer, type InventoryItemDrawerProps } from "@/components/composites/InventoryItemDrawer"

import { ACTIONS_CLASS_NAME, STACK_CLASS_NAME, TOOLBAR_CLASS_NAME, TOOLBAR_FIELD_CLASS_NAME } from "./classNames"

/** One catalogue item, every word already resolved. */
export interface StockRowView {
    readonly id: string
    readonly name: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly onOrderLabel: string | null
    readonly detail: string
    readonly total: string
    readonly stepLabel: string
    readonly lessLabel: string
    readonly moreLabel: string
}

/** The words and data of the stock tab. */
export interface InventoryStockBaseProps {
    readonly props: {
        readonly searchLabel: string
        readonly searchPlaceholder: string
        readonly clearLabel: string
        readonly addLabel: string | null
        readonly draftLabel: string | null
        readonly filterLabel: string
        readonly filters: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly listLabel: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly adjustLabel: string
        readonly editLabel: string | null
        readonly toggleInactiveLabel: string | null
        readonly query: string
        readonly filter: string
        readonly rows: ReadonlyArray<StockRowView>
        readonly isPending: boolean
        readonly error: string | null
        readonly notice: string | null
        /** The item drawer while it is open. */
        readonly itemDrawer: InventoryItemDrawerProps["props"] | null
        /** The quantity drawer while it is open. */
        readonly adjustDrawer: InventoryAdjustDrawerProps["props"] | null
    }
    readonly on: {
        readonly query: (value: string) => void
        readonly filter: (value: string) => void
        readonly add: () => void
        readonly draft: () => void
        readonly quick: (id: string, sign: 1 | -1) => void
        readonly adjust: (id: string) => void
        readonly edit: (id: string) => void
        readonly toggleInactive: () => void
        readonly itemField: (name: ItemFormField, value: string) => void
        readonly itemSave: () => void
        readonly itemToggle: () => void
        readonly itemClose: () => void
        readonly adjustMode: (value: string) => void
        readonly adjustFrom: (value: string) => void
        readonly adjustTo: (value: string) => void
        readonly adjustValue: (value: string) => void
        readonly adjustReason: (value: string) => void
        readonly adjustSubmit: () => void
        readonly adjustClose: () => void
    }
}

/** The stock tab: every item with its level, quick plus and minus buttons, and the forms that change it. */
export const InventoryStockBase = (props: InventoryStockBaseProps) => {
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
                <div className={ACTIONS_CLASS_NAME}>
                    {p.addLabel === null ? null : (
                        <Button intent="commit" size="sm" onPress={on.add}>
                            {p.addLabel}
                        </Button>
                    )}
                    {p.draftLabel === null ? null : (
                        <Button intent="alternative" size="sm" isPending={p.isPending} onPress={on.draft}>
                            {p.draftLabel}
                        </Button>
                    )}
                </div>
            </div>
            <SegmentedControl
                label={p.filterLabel}
                isLabelHidden
                options={p.filters}
                value={p.filter}
                onValueChange={on.filter}
            />
            <InventoryNotices error={p.error} notice={p.notice} />
            {renderListLabel(props)}
            {p.toggleInactiveLabel === null ? null : (
                <div>
                    <Button intent="neutral" size="sm" onPress={on.toggleInactive}>
                        {p.toggleInactiveLabel}
                    </Button>
                </div>
            )}
            {p.itemDrawer === null ? null : (
                <InventoryItemDrawer
                    props={p.itemDrawer}
                    on={{ field: on.itemField, save: on.itemSave, toggleActive: on.itemToggle, close: on.itemClose }}
                />
            )}
            {p.adjustDrawer === null ? null : (
                <InventoryAdjustDrawer
                    props={p.adjustDrawer}
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
        </div>
    )
}

/** Draws the listLabel section of the current view. */
const renderListLabel = (props: InventoryStockBaseProps) => {
    const { props: p, on } = props
    return (
        <SurfaceListCard
            ariaLabel={p.listLabel}
            empty={<EmptyNotice message={p.emptyTitle} description={p.emptyBody} />}
        >
            {p.rows.map((row) => (
                <ListRow
                    key={row.id}
                    title={row.name}
                    description={row.detail}
                    badges={
                        <>
                            <Badge tone={row.statusTone} isDot>
                                {row.statusLabel}
                            </Badge>
                            {row.onOrderLabel === null ? null : <Badge tone="accent">{row.onOrderLabel}</Badge>}
                        </>
                    }
                    actions={
                        <div className={ACTIONS_CLASS_NAME}>
                            <Text size="md" weight="semibold">
                                {row.total}
                            </Text>
                            <Button
                                intent="neutral"
                                size="sm"
                                aria-label={row.lessLabel}
                                isDisabled={p.isPending}
                                onPress={() => on.quick(row.id, -1)}
                            >
                                {`-${row.stepLabel}`}
                            </Button>
                            <Button
                                intent="neutral"
                                size="sm"
                                aria-label={row.moreLabel}
                                isDisabled={p.isPending}
                                onPress={() => on.quick(row.id, 1)}
                            >
                                {`+${row.stepLabel}`}
                            </Button>
                            <Button intent="neutral" size="sm" onPress={() => on.adjust(row.id)}>
                                {p.adjustLabel}
                            </Button>
                            {p.editLabel === null ? null : (
                                <Button intent="neutral" size="sm" onPress={() => on.edit(row.id)}>
                                    {p.editLabel}
                                </Button>
                            )}
                        </div>
                    }
                />
            ))}
        </SurfaceListCard>
    )
}

/** Inputs needed to build the InventoryStockContent section. */
export interface BuildStockListViewContext {
    readonly t: ReturnType<typeof useTranslations<"workbenchInventory">>
    readonly board: ReturnType<typeof useInventoryBoard>
    readonly lowCount: number
    readonly empty: boolean
    readonly hasInactive: boolean
    readonly showInactive: boolean
    readonly query: string
    readonly filter: StockFilter
    readonly rows: ItemView[]
    readonly format: ReturnType<typeof useInventoryFormat>
    readonly detailOf: (item: ItemView) => string
    readonly run: ReturnType<typeof useInventoryRun>
    readonly itemDrawer: ReturnType<typeof useItemDrawer>
    readonly adjustDrawer: ReturnType<typeof useAdjustDrawer>
}

/** Inputs needed to build the InventoryStockContent section. */
export interface BuildStockCommandsContext {
    readonly setQuery: React.Dispatch<React.SetStateAction<string>>
    readonly setFilter: React.Dispatch<React.SetStateAction<StockFilter>>
    readonly itemDrawer: ReturnType<typeof useItemDrawer>
    readonly draft: () => void
    readonly quick: (id: string, sign: 1 | -1) => void
    readonly board: ReturnType<typeof useInventoryBoard>
    readonly adjustDrawer: ReturnType<typeof useAdjustDrawer>
    readonly setShowInactive: React.Dispatch<React.SetStateAction<boolean>>
}
