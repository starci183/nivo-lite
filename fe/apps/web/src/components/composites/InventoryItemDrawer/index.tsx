import { InventorySelect } from "@/components/leaves/InventorySelect"
import { InventoryNotices } from "@/components/leaves/InventoryNotices"
import type { ItemFormValues, ItemFormField } from "@/hooks/inventory"
import { Button, Drawer, Input } from "@starci/grammar/common"
import type { InventorySay } from "@/modules/types"
import { ACTIONS_CLASS_NAME, FORM_CLASS_NAME, FORM_GRID_CLASS_NAME } from "./classNames"

/** The words and state of the item drawer. */
export interface InventoryItemDrawerProps {
    readonly props: {
        readonly say: InventorySay
        /** The name of the item being changed, or null when a new one is added. */
        readonly editing: string | null
        /** Whether the item being changed is in use; null for a new item. */
        readonly active: boolean | null
        readonly values: ItemFormValues
        readonly suppliers: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly isPending: boolean
        readonly error: string | null
    }
    readonly on: {
        readonly field: (name: ItemFormField, value: string) => void
        readonly save: () => void
        readonly toggleActive: () => void
        readonly close: () => void
    }
}

/** The form that adds or changes one catalogue item. */
export const InventoryItemDrawer = (props: InventoryItemDrawerProps) => {
    const { props: p, on } = props
    const say = p.say
    const text = (name: ItemFormField, id: string, label: string, hint?: string) => (
        <Input
            id={id}
            name={name}
            label={label}
            {...(hint === undefined ? {} : { hint })}
            variant="secondary"
            value={p.values[name]}
            onValueChange={(value) => on.field(name, value)}
        />
    )
    return (
        <Drawer
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            title={p.editing === null ? say("itemAddTitle") : say("itemEditTitle", { name: p.editing })}
            description={say("itemDrawerHint")}
            closeLabel={say("close")}
            placement="right"
        >
            <div className={FORM_CLASS_NAME}>
                {text("name", "inv-name", say("itemName"))}
                <div className={FORM_GRID_CLASS_NAME}>
                    {text("sku", "inv-sku", say("itemSku"), say("itemSkuHint"))}
                    {text("unit", "inv-unit", say("itemUnit"), say("itemUnitHint"))}
                </div>
                {text("units", "inv-units", say("itemUnits"), say("itemUnitsHint"))}
                <div className={FORM_GRID_CLASS_NAME}>
                    {text("category", "inv-cat", say("itemCategory"))}
                    <InventorySelect
                        label={say("itemSupplier")}
                        placeholder={say("itemSupplierNone")}
                        value={p.values.supplierId}
                        options={p.suppliers}
                        onChange={(value) => on.field("supplierId", value)}
                    />
                </div>
                <div className={FORM_GRID_CLASS_NAME}>
                    {text("cost", "inv-cost", say("itemCost"))}
                    {text("sell", "inv-sell", say("itemSell"))}
                    {text("reorderPoint", "inv-rp", say("itemReorderPoint"), say("itemReorderPointHint"))}
                    {text("reorderQty", "inv-rq", say("itemReorderQty"))}
                </div>
                {text("aliases", "inv-alias", say("itemAliases"), say("itemAliasesHint"))}
                {p.editing === null ? text("openingQty", "inv-open", say("itemOpening")) : null}
                <InventoryNotices error={p.error} />
                <div className={ACTIONS_CLASS_NAME}>
                    <Button variant="primary" isPending={p.isPending} onPress={on.save}>
                        {say("save")}
                    </Button>
                    {p.active === null ? null : (
                        <Button variant="outline" isDisabled={p.isPending} onPress={on.toggleActive}>
                            {p.active ? say("itemStop") : say("itemResume")}
                        </Button>
                    )}
                </div>
            </div>
        </Drawer>
    )
}
