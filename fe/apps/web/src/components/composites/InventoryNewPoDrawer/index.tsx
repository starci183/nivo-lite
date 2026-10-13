import { InventoryPick } from "@/components/branches/InventoryPick"
import { InventorySelect } from "@/components/leaves/InventorySelect"
import { InventoryField } from "@/components/leaves/InventoryField"
import { InventoryNotices } from "@/components/leaves/InventoryNotices"
import { Button, Drawer } from "@starci/grammar/common"
import type { InventorySay } from "@/modules/types"
import { FORM_CLASS_NAME, LINE_ROW_CLASS_NAME } from "./classNames"

/** One line of the new order form. */
interface NewPoLineView {
    readonly key: string
    readonly itemId: string
    readonly qty: string
    readonly cost: string
}

/** The words and state of the new purchase order drawer. */
export interface InventoryNewPoDrawerProps {
    readonly props: {
        readonly say: InventorySay
        readonly supplierId: string
        readonly suppliers: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly items: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly lines: ReadonlyArray<NewPoLineView>
        readonly isPending: boolean
        readonly error: string | null
    }
    readonly on: {
        readonly supplier: (value: string) => void
        readonly pick: (index: number, itemId: string) => void
        readonly qty: (index: number, value: string) => void
        readonly cost: (index: number, value: string) => void
        readonly addLine: () => void
        readonly create: () => void
        readonly close: () => void
    }
}

/** The form that creates a purchase order by hand. */
export const InventoryNewPoDrawer = (props: InventoryNewPoDrawerProps) => {
    const { props: p, on } = props
    const say = p.say
    return (
        <Drawer
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            title={say("newPoTitle")}
            description={say("newPoHint")}
            closeLabel={say("close")}
            placement="right"
        >
            <div className={FORM_CLASS_NAME}>
                <InventorySelect
                    label={say("poSupplier")}
                    placeholder={say("poSupplierHint")}
                    value={p.supplierId}
                    options={p.suppliers}
                    onChange={(value) => on.supplier(value)}
                />
                {p.lines.map((line, index) => (
                    <div key={line.key} className={LINE_ROW_CLASS_NAME}>
                        <InventoryPick
                            selectLabel={say("newPoItem", { n: index + 1 })}
                            selectHint={say("newPoItemHint")}
                            itemId={line.itemId}
                            options={p.items}
                            qtyId={`new-q-${line.key}`}
                            qtyName={`nq-${line.key}`}
                            qtyLabel={say("poQty")}
                            qty={line.qty}
                            onPick={(value) => on.pick(index, value)}
                            onQty={(value) => on.qty(index, value)}
                        />
                        <InventoryField
                            id={`new-c-${line.key}`}
                            name={`nc-${line.key}`}
                            label={say("poUnitCost")}
                            value={line.cost}
                            onChange={(value) => on.cost(index, value)}
                        />
                    </div>
                ))}
                <div>
                    <Button variant="ghost" size="sm" onPress={on.addLine}>
                        {say("newPoAddLine")}
                    </Button>
                </div>
                <InventoryNotices error={p.error} />
                <div>
                    <Button variant="primary" isPending={p.isPending} onPress={on.create}>
                        {say("newPoCreate")}
                    </Button>
                </div>
            </div>
        </Drawer>
    )
}
