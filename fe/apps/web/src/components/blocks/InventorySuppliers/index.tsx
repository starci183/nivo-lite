"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { openById, useInventoryRun, useSupplierDrawer } from "@/hooks/inventory"
import type { InventoryWorkbenchData, SupplierView } from "@/modules/types"
import { useInventoryCatalogCommands } from "@/hooks/inventoryCommands"
import { InventorySuppliersBase } from "./component"

/** The workbench data and the workspace. */
interface InventorySuppliersProps {
    readonly data: InventoryWorkbenchData
}

/** The suppliers tab: the typed location name lives here, the drawer in its hook, the drawing in the pure half. */
export const InventorySuppliers = (props: InventorySuppliersProps) => {
    const t = useTranslations("workbenchInventory")
    const run = useInventoryRun()
    const { data } = props
    const commands = useInventoryCatalogCommands()
    const drawer = useSupplierDrawer(commands)
    const [locationName, setLocationName] = useState("")
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
    return (
        <InventorySuppliersBase
            props={{
                addLabel: data.canManage ? t("supplierAdd") : null,
                editLabel: data.canManage ? t("edit") : null,
                listLabel: t("supplierList"),
                emptyTitle: t("supplierEmptyTitle"),
                emptyBody: t("supplierEmptyBody"),
                rows: data.suppliers.map((supplier) => ({
                    id: supplier.id,
                    name: supplier.name,
                    channelLabel: t(`channel_${supplier.channel}`),
                    detail: detailOf(supplier),
                    itemsText: t("supplierItems", {
                        n: data.items.filter((item) => item.supplierId === supplier.id && item.active).length,
                    }),
                })),
                locationsTitle: t("locationsTitle"),
                locationsText: t("locationsText", {
                    list: data.locations.map((location) => location.name).join(" · "),
                    count: data.locations.length,
                }),
                canAddLocation: data.canManage,
                locationLabel: t("locationAdd"),
                locationAddLabel: t("locationAddButton"),
                locationName,
                isPending: run.isPending,
                error: run.error,
                drawer: drawer.props,
            }}
            on={{
                add: () => drawer.open(null),
                edit: openById(data.suppliers, drawer.open),
                locationName: setLocationName,
                addLocation: () =>
                    run.exec(
                        () => commands.saveLocation(locationName),
                        () => {
                            setLocationName("")
                            return undefined
                        },
                    ),
                supplierField: drawer.on.field,
                supplierSave: drawer.on.save,
                supplierClose: drawer.on.close,
            }}
        />
    )
}
