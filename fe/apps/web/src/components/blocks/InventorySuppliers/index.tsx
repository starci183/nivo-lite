"use client"

import { useInventoryBoard } from "@/hooks/inventoryBoard"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { openById, useInventoryRun, useSupplierDrawer } from "@/hooks/inventory"
import type { SupplierView } from "@/modules/types"
import { useInventoryCatalogCommands } from "@/hooks/inventoryCommands"
import { InventorySuppliersBase } from "./component"

/** The suppliers tab: the typed location name lives here, the drawer in its hook, the drawing in the pure half. */
export const InventorySuppliers = () => {
    const board = useInventoryBoard()
    const t = useTranslations("workbenchInventory")
    const run = useInventoryRun()
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
            }}
            on={{
                add: () => drawer.open(null),
                edit: openById(board.suppliers, drawer.open),
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
