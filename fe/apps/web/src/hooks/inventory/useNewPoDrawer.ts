"use client"

import type { InventoryWorkbenchData } from "@/modules/types"
import { changeAt } from "./inventory.shared"
import type { InventoryCommandSet } from "@/hooks/inventoryCommands"
import { useDrawer } from "./useDrawer"
import { useInventoryRun } from "./useInventoryRun"
import { useSay } from "./useSay"

/** One typed line with the key that keeps its inputs stable while lines come and go. */
interface TypedLine {
    readonly key: string
    readonly itemId: string
    readonly qty: string
    readonly cost: string
}

/** The new order form while the drawer is open. */
interface NewPoState {
    readonly supplierId: string
    readonly lines: ReadonlyArray<TypedLine>
    readonly serial: number
}

const blankLine = (serial: number): TypedLine => ({ key: `line-${serial}`, itemId: "", qty: "", cost: "" })

/** Opens, fills and saves the new purchase order form; `props` is null while the drawer is closed. */
export const useNewPoDrawer = (data: InventoryWorkbenchData, commands: InventoryCommandSet<"createPo">) => {
    const say = useSay()
    const run = useInventoryRun()
    const drawer = useDrawer<NewPoState>()
    const { state, change } = drawer
    return {
        open: () => drawer.open({ supplierId: "", lines: [blankLine(0)], serial: 1 }),
        props:
            state === null
                ? null
                : {
                      say,
                      supplierId: state.supplierId,
                      suppliers: data.suppliers.map((supplier) => ({ id: supplier.id, label: supplier.name })),
                      items: data.items
                          .filter(
                              (item) =>
                                  item.active &&
                                  (state.supplierId === "" ||
                                      item.supplierId === null ||
                                      item.supplierId === state.supplierId),
                          )
                          .map((item) => ({ id: item.id, label: `${item.name} (${item.unit})` })),
                      lines: state.lines,
                      isPending: run.isPending,
                      error: run.error,
                  },
        on: {
            supplier: (supplierId: string) => change((current) => ({ ...current, supplierId })),
            pick: (index: number, itemId: string) => {
                const item = data.items.find((entry) => entry.id === itemId)
                const usual = item !== undefined && item.reorderQty > 0 ? String(item.reorderQty) : ""
                change((current) => ({
                    ...current,
                    lines: changeAt(current.lines, index, {
                        itemId,
                        qty: current.lines[index]?.qty || usual,
                        cost: item === undefined ? "" : String(item.costVnd),
                    }),
                }))
            },
            qty: (index: number, qty: string) =>
                change((current) => ({ ...current, lines: changeAt(current.lines, index, { qty }) })),
            cost: (index: number, cost: string) =>
                change((current) => ({ ...current, lines: changeAt(current.lines, index, { cost }) })),
            addLine: () =>
                change((current) => ({
                    ...current,
                    lines: [...current.lines, blankLine(current.serial)],
                    serial: current.serial + 1,
                })),
            create: () => {
                if (state === null) return
                run.exec(
                    () =>
                        commands.createPo({
                            supplierId: state.supplierId,
                            expectedAt: "",
                            lines: state.lines.map((line) => ({
                                itemId: line.itemId,
                                qty: line.qty,
                                unitCost: line.cost,
                            })),
                        }),
                    drawer.done,
                )
            },
            close: drawer.close,
        },
    }
}
