"use client"

import { useFeatureReset } from "@/hooks/reuseables"
import type { InventoryPanelInput } from "./inventoryWorkbench.shared"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { openById, useInventoryRun, useSupplierDrawer } from "@/hooks/inventory"
import type { SupplierView, SupplierFormValues, SupplierFormField } from "@/modules/types"
import { useInventoryCatalogCommands } from "@/hooks/inventoryCommands"

/** The view `useInventorySuppliersView` returns. */
export interface InventorySuppliersView {
    readonly props: {
        readonly addLabel: string | null
        readonly editLabel: string | null
        readonly listLabel: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly rows: {
            id: string
            name: string
            channelLabel: string
            detail: string
            itemsText: string
        }[]
        readonly locationsTitle: string
        readonly locationsText: string
        readonly canAddLocation: boolean
        readonly locationLabel: string
        readonly locationAddLabel: string
        readonly locationName: string
        readonly isPending: boolean
        readonly error: string | null
        readonly drawer: {
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
    }
    readonly on: {
        readonly onAdd: () => void
        readonly onEdit: (id: string) => void
        readonly onLocationName: (value: string) => void
        readonly onAddLocation: () => void
        readonly onSupplierField: (name: SupplierFormField, value: string) => void
        readonly onSupplierSave: () => void
        readonly onSupplierClose: () => void
    }
}

/** The suppliers tab: the typed location name lives here, the drawer in its hook, the drawing in the pure half. */
export const useInventorySuppliersView = (input: InventoryPanelInput): InventorySuppliersView => {
    const board = input.board
    const lifetime = { isActive: input.isActive, scope: input.scope }
    const t = useTranslations("workbenchInventory")
    const run = useInventoryRun(input.isActive, input.scope)
    const commands = useInventoryCatalogCommands()
    const drawer = useSupplierDrawer(commands, lifetime)
    const [locationName, setLocationName] = useState("")
    useFeatureReset({
        isActive: input.isActive,
        isReady: true,
        scope: input.scope,
        onReset: () => {
            setLocationName("")
        },
    })
    const detailOf = (supplier: SupplierView): string =>
        [
            supplier.contactName,
            supplier.email ?? "",
            supplier.phone ?? "",
            supplier.zalo === null || supplier.zalo === "" ? "" : t("supplierZaloLine", { zalo: supplier.zalo }),
            t("supplierLeadLine", { n: supplier.leadTimeDays }),
            supplier.paymentTerms,
        ]
            .filter((part) => part !== "")
            .join(" · ")
    return {
        props: {
            addLabel: board.canManage ? t("supplierAdd") : null,
            editLabel: board.canManage ? t("edit") : null,
            listLabel: t("supplierList"),
            emptyTitle: t("supplierEmptyTitle"),
            emptyBody: t("supplierEmptyBody"),
            rows: board.suppliers.map((supplier) => ({
                id: supplier.id,
                name: supplier.name,
                channelLabel: t(`channel_${supplier.channel}`),
                detail: detailOf(supplier),
                itemsText: t("supplierItems", {
                    n: board.items.filter((item) => item.supplierId === supplier.id && item.active).length,
                }),
            })),
            locationsTitle: t("locationsTitle"),
            locationsText: t("locationsText", {
                list: board.locations.map((location) => location.name).join(" · "),
                count: board.locations.length,
            }),
            canAddLocation: board.canManage,
            locationLabel: t("locationAdd"),
            locationAddLabel: t("locationAddButton"),
            locationName,
            isPending: run.isPending,
            error: run.error,
            drawer: drawer.props,
        },
        on: {
            onAdd: () => drawer.open(null),
            onEdit: openById(board.suppliers, drawer.open),
            onLocationName: (value: string) => setLocationName(value),
            onAddLocation: () =>
                run.exec(
                    () => commands.saveLocation(locationName),
                    (_value, isCurrent) => {
                        if (isCurrent()) setLocationName("")
                        return undefined
                    },
                ),
            onSupplierField: drawer.on.field,
            onSupplierSave: drawer.on.save,
            onSupplierClose: drawer.on.close,
        },
    } as const
}
