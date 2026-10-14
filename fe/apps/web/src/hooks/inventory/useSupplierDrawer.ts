"use client"

import { useTranslations } from "next-intl"
import type { SupplierView } from "@/modules/types"
import type { SupplierFormField, SupplierFormValues } from "./inventory.shared"
import type { InventoryCommandSet } from "@/hooks/inventoryCommands"
import { useDrawer } from "./useDrawer"
import { useInventoryRun } from "./useInventoryRun"
import { useSay } from "./useSay"

/** The supplier drawer while it is open: the supplier being changed (null adds one) and what was typed. */
interface SupplierDrawerState {
    readonly supplier: SupplierView | null
    readonly values: SupplierFormValues
}

const DEFAULT_LEAD_DAYS = "2"

const CHANNELS: ReadonlyArray<string> = ["email", "zalo", "phone"]

const startSupplierState = (supplier: SupplierView | null): SupplierDrawerState => ({
    supplier,
    values: {
        name: supplier?.name ?? "",
        contactName: supplier?.contactName ?? "",
        email: supplier?.email ?? "",
        phone: supplier?.phone ?? "",
        zalo: supplier?.zalo ?? "",
        channel: supplier?.channel ?? "email",
        leadTime: supplier === null ? DEFAULT_LEAD_DAYS : String(supplier.leadTimeDays),
        terms: supplier?.paymentTerms ?? "",
        note: supplier?.note ?? "",
    },
})

/** Opens, fills and saves the supplier form; `props` is null while the drawer is closed. */
export const useSupplierDrawer = (commands: InventoryCommandSet<"saveSupplier">) => {
    const t = useTranslations("workbenchInventory")
    const say = useSay()
    const run = useInventoryRun()
    const drawer = useDrawer<SupplierDrawerState>()
    const { state } = drawer
    return {
        open: (target: SupplierView | null) => drawer.open(startSupplierState(target)),
        props:
            state === null
                ? null
                : {
                      say,
                      editing: state.supplier === null ? null : state.supplier.name,
                      values: state.values,
                      channels: CHANNELS.map((value) => ({ value, label: t(`channel_${value}`) })),
                      isPending: run.isPending,
                      error: run.error,
                  },
        on: {
            field: (name: SupplierFormField, value: string) =>
                drawer.change((current) => ({ ...current, values: { ...current.values, [name]: value } })),
            save: () => {
                if (state === null) return
                const target = state.supplier
                run.exec(
                    () =>
                        commands.saveSupplier({
                            ...(target === null ? {} : { id: target.id }),
                            ...state.values,
                        }),
                    drawer.done,
                )
            },
            close: drawer.close,
        },
    }
}
