"use client"

import type { InventoryPanelScope } from "./inventory.shared"
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

/** The view `useNewPoDrawer` returns. */
export interface NewPoDrawerView {
    open: () => void
    props: {
        copy: {
            readonly newPoTitle: string
            readonly newPoHint: string
            readonly close: string
            readonly poSupplier: string
            readonly poSupplierHint: string
            readonly newPoItemHint: string
            readonly poQty: string
            readonly poUnitCost: string
            readonly newPoAddLine: string
            readonly newPoCreate: string
        }
        supplierId: string
        suppliers: {
            id: string
            label: string
        }[]
        items: {
            id: string
            label: string
        }[]
        lines: {
            itemLabel: string
            key: string
            itemId: string
            qty: string
            cost: string
        }[]
        isPending: boolean
        error: string | null
    } | null
    on: {
        supplier: (supplierId: string) => void
        pick: (index: number, itemId: string) => void
        qty: (index: number, qty: string) => void
        cost: (index: number, cost: string) => void
        addLine: () => void
        create: () => void
        close: () => void
    }
}

/** Opens, fills and saves the new purchase order form; `props` is null while the drawer is closed. */
export const useNewPoDrawer = (
    data: InventoryWorkbenchData,
    commands: InventoryCommandSet<"createPo">,
    lifetime?: InventoryPanelScope,
): NewPoDrawerView => {
    const { isActive = true, scope = "" } = lifetime ?? {}

    const say = useSay()
    const run = useInventoryRun(isActive, scope)
    const drawer = useDrawer<NewPoState>(isActive, scope)
    const { state, change } = drawer
    return {
        open: () => drawer.open({ supplierId: "", lines: [blankLine(0)], serial: 1 }),
        props:
            state === null
                ? null
                : {
                      copy: newPoDrawerCopy(say),
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
                      lines: state.lines.map((line, index) => ({
                          ...line,
                          itemLabel: say("newPoItem", { n: index + 1 }),
                      })),
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
                    drawer.finish,
                )
            },
            close: drawer.close,
        },
    }
}

/** Resolves the exact newpo drawer copy in its domain owner. */
const newPoDrawerCopy = (say: ReturnType<typeof useSay>) =>
    ({
        newPoTitle: say("newPoTitle"),
        newPoHint: say("newPoHint"),
        close: say("close"),
        poSupplier: say("poSupplier"),
        poSupplierHint: say("poSupplierHint"),
        newPoItemHint: say("newPoItemHint"),
        poQty: say("poQty"),
        poUnitCost: say("poUnitCost"),
        newPoAddLine: say("newPoAddLine"),
        newPoCreate: say("newPoCreate"),
    }) as const
