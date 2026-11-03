"use client"

import { type InventoryPanelScope } from "./inventory.shared"
import { useTranslations } from "next-intl"
import type { SupplierFormField, SupplierFormValues, SupplierView } from "@/modules/types"
import type { InventoryCommandSet } from "@/hooks/inventoryCommands"
import { sayAll } from "@/modules/inventory"
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

/** The view `useSupplierDrawer` returns. */
export interface SupplierDrawerView {
    open: (target: SupplierView | null) => void
    props: {
        copy: {
            supplierEditTitle: string
            close: string
            save: string
            supplierAddTitle: string
            supplierDrawerHint: string
            supplierName: string
            supplierContact: string
            supplierChannel: string
            supplierEmail: string
            supplierPhone: string
            supplierZalo: string
            supplierLead: string
            supplierTerms: string
            supplierNote: string
        }
        editing: string | null
        values: SupplierFormValues
        channels: {
            value: string
            label: string
        }[]
        isPending: boolean
        error: string | null
    } | null
    on: {
        field: (name: SupplierFormField, value: string) => void
        save: () => void
        close: () => void
    }
}

/** Opens, fills and saves the supplier form; `props` is null while the drawer is closed. */
export const useSupplierDrawer = (
    commands: InventoryCommandSet<"saveSupplier">,
    lifetime?: InventoryPanelScope,
): SupplierDrawerView => {
    const { isActive = true, scope = "" } = lifetime ?? {}

    const t = useTranslations("workbenchInventory")
    const say = useSay()
    const run = useInventoryRun(isActive, scope)
    const drawer = useDrawer<SupplierDrawerState>(isActive, scope)
    const { state } = drawer
    return {
        open: (target: SupplierView | null) => drawer.open(startSupplierState(target)),
        props:
            state === null
                ? null
                : {
                      copy: supplierDrawerCopy(say, state.supplier),
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
                    drawer.finish,
                )
            },
            close: drawer.close,
        },
    }
}

/** The sentences of the catalog the drawer reads under their own names. */
const SUPPLIER_DRAWER_KEYS = [
    "supplierAddTitle",
    "supplierDrawerHint",
    "close",
    "supplierName",
    "supplierContact",
    "supplierChannel",
    "supplierEmail",
    "supplierPhone",
    "supplierZalo",
    "supplierLead",
    "supplierTerms",
    "supplierNote",
    "save",
] as const

/** Resolves the exact supplier drawer copy in its domain owner. */
const supplierDrawerCopy = (say: ReturnType<typeof useSay>, owner: SupplierView | null) => ({
    ...sayAll(say, SUPPLIER_DRAWER_KEYS),
    supplierEditTitle: say("supplierEditTitle", { name: owner?.name ?? "" }),
})
