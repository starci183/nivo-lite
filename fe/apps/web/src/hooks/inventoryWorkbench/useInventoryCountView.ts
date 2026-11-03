"use client"

import { useFeatureReset } from "@/hooks/reuseables"
import type { InventoryPanelInput } from "./inventoryWorkbench.shared"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { includesText, num, useInventoryFormat, useInventoryRun } from "@/hooks/inventory"
import { useInventoryStockCommands } from "@/hooks/inventoryCommands"

/** The view `useInventoryCountView` returns. */
export interface InventoryCountView {
    readonly props: {
        readonly intro: string
        readonly searchLabel: string
        readonly searchPlaceholder: string
        readonly clearLabel: string
        readonly listLabel: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly submitLabel: string
        readonly query: string
        readonly rows: {
            id: string
            name: string
            machine: string
            fieldLabel: string
            unit: string
            value: string
        }[]
        readonly canSubmit: boolean
        readonly isPending: boolean
        readonly error: string | null
        readonly notice: string | null
    }
    readonly on: {
        readonly onQuery: (value: string) => void
        readonly onCount: (id: string, value: string) => void
        readonly onSubmit: () => void
    }
}

/** The stock count tab: the search text and the typed counts live here, the drawing in the pure half. */
export const useInventoryCountView = (input: InventoryPanelInput): InventoryCountView => {
    const board = input.board
    const t = useTranslations("workbenchInventory")
    const format = useInventoryFormat()
    const commands = useInventoryStockCommands()
    const run = useInventoryRun(input.isActive, input.scope)
    const [query, setQuery] = useState("")
    const [counts, setCounts] = useState<Readonly<Record<string, string>>>({})
    useFeatureReset({
        isActive: input.isActive,
        isReady: true,
        scope: input.scope,
        onReset: () => {
            setQuery("")
            setCounts({})
        },
    })
    const rows = board.items.filter(
        (item) => item.active && includesText(`${item.name} ${item.sku} ${item.category}`, query),
    )
    const entered = Object.entries(counts).filter(
        ([, value]) => value.trim() !== "" && Number.isFinite(num(value, Number.NaN)),
    )
    const submit = () =>
        run.exec(
            () => commands.stockTake(entered.map(([itemId, value]) => ({ itemId, counted: num(value) }))),
            (result, isCurrent) => {
                if (isCurrent()) setCounts({})
                return t("countDone", {
                    applied: result.applied,
                    same: result.same,
                    waiting: result.waiting > 0 ? t("countWaiting", { n: result.waiting }) : "",
                })
            },
        )
    return {
        props: {
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
        },
        on: {
            onQuery: (value: string) => setQuery(value),
            onCount: (id: string, value: string) => setCounts((current) => ({ ...current, [id]: value })),
            onSubmit: submit,
        },
    } as const
}
