"use client"

import { useInventoryBoard } from "@/hooks/inventoryBoard"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { includesText, num, useInventoryFormat, useInventoryRun } from "@/hooks/inventory"
import { useInventoryStockCommands } from "@/hooks/inventoryCommands"
import { InventoryCountBase } from "./component"

/** The stock count tab: the search text and the typed counts live here, the drawing in the pure half. */
export const InventoryCount = () => {
    const board = useInventoryBoard()
    const t = useTranslations("workbenchInventory")
    const format = useInventoryFormat()
    const commands = useInventoryStockCommands()
    const run = useInventoryRun()
    const [query, setQuery] = useState("")
    const [counts, setCounts] = useState<Readonly<Record<string, string>>>({})
    const rows = board.items.filter(
        (item) => item.active && includesText(`${item.name} ${item.sku} ${item.category}`, query),
    )
    const entered = Object.entries(counts).filter(
        ([, value]) => value.trim() !== "" && Number.isFinite(num(value, Number.NaN)),
    )
    const submit = () =>
        run.exec(
            () => commands.stockTake(entered.map(([itemId, value]) => ({ itemId, counted: num(value) }))),
            (result) => {
                setCounts({})
                return t("countDone", {
                    applied: result.applied,
                    same: result.same,
                    waiting: result.waiting > 0 ? t("countWaiting", { n: result.waiting }) : "",
                })
            },
        )
    return (
        <InventoryCountBase
            props={{
                intro: t("countIntro"),
                searchLabel: t("stockSearch"),
                searchPlaceholder: t("countSearchHint"),
                clearLabel: t("clearSearch"),
                listLabel: t("countList"),
                emptyTitle: t("countEmptyTitle"),
                emptyBody: t("countEmptyBody"),
                submitLabel: t("countSubmit", { n: entered.length }),
                query,
                rows: rows.map((item) => ({
                    id: item.id,
                    name: item.name,
                    machine: t("countMachine", { qty: format.qty(item.total), unit: item.unit }),
                    fieldLabel: t("countField", { unit: item.unit }),
                    unit: item.unit,
                    value: counts[item.id] ?? "",
                })),
                canSubmit: entered.length > 0,
                isPending: run.isPending,
                error: run.error,
                notice: run.notice,
            }}
            on={{
                query: setQuery,
                count: (id, value) => setCounts((current) => ({ ...current, [id]: value })),
                submit,
            }}
        />
    )
}
