"use client"

import { useFeatureReset } from "@/hooks/reuseables"
import type { InventoryPanelInput } from "./inventoryWorkbench.shared"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { MOVE_KINDS, MOVE_TONES, includesText, useInventoryFormat } from "@/hooks/inventory"

const ALL = "all"

/** The view `useInventoryHistoryView` returns. */
export interface InventoryHistoryView {
    readonly props: {
        readonly searchLabel: string
        readonly searchPlaceholder: string
        readonly clearLabel: string
        readonly kindLabel: string
        readonly kinds: readonly [
            {
                readonly value: "all"
                readonly label: string
            },
            {
                readonly value: "in"
                readonly label: string
            },
            {
                readonly value: "out"
                readonly label: string
            },
            {
                readonly value: "adjust"
                readonly label: string
            },
        ]
        readonly listLabel: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly query: string
        readonly kind: string
        readonly rows: {
            id: string
            kindLabel: string
            kindTone: "success" | "neutral" | "warning" | "accent"
            itemName: string
            quantity: string
            detail: string
            evidence: string | null
            stamp: string
        }[]
    }
    readonly on: {
        readonly onQuery: (value: string) => void
        readonly onKind: (value: string) => void
    }
}

/** The history tab: the search text and the movement kind live here, the drawing in the pure half. */
export const useInventoryHistoryView = (input: InventoryPanelInput): InventoryHistoryView => {
    const board = input.board
    const t = useTranslations("workbenchInventory")
    const format = useInventoryFormat()
    const [query, setQuery] = useState("")
    const [kind, setKind] = useState(ALL)
    useFeatureReset({
        isActive: input.isActive,
        isReady: true,
        scope: input.scope,
        onReset: () => {
            setQuery("")
            setKind(ALL)
        },
    })
    const kindName = (value: string): string => (MOVE_KINDS.includes(value) ? t(`move_${value}`) : value)
    const rows = board.movements.filter(
        (movement) =>
            (kind === ALL || movement.kind === kind) &&
            includesText(`${movement.itemName} ${movement.reason} ${movement.refLabel ?? ""}`, query),
    )
    return {
        props: {
            searchLabel: t("historySearch"),
            searchPlaceholder: t("historySearchHint"),
            clearLabel: t("clearSearch"),
            kindLabel: t("historyKind"),
            kinds: [
                { value: ALL, label: t("filterAll") },
                { value: "in", label: t("move_in") },
                { value: "out", label: t("move_out") },
                { value: "adjust", label: t("move_adjust") },
            ],
            listLabel: t("historyList"),
            emptyTitle: t("historyEmptyTitle"),
            emptyBody: t("historyEmptyBody"),
            query,
            kind,
            rows: rows.map((movement) => ({
                id: movement.id,
                kindLabel: kindName(movement.kind),
                kindTone: MOVE_TONES[movement.kind] ?? "neutral",
                itemName: movement.itemName === "" ? t("itemGone") : movement.itemName,
                quantity: `${movement.qty > 0 ? "+" : ""}${format.qty(movement.qty)} ${movement.unit}`,
                detail: t("historyDetail", {
                    reason: movement.reason,
                    ref: movement.refLabel === null ? "" : ` · ${movement.refLabel}`,
                    left: format.qty(movement.qtyAfter),
                    by: movement.byName,
                }),
                evidence: movement.evidence,
                stamp: format.stamp(movement.createdAt),
            })),
        },
        on: { onQuery: (value: string) => setQuery(value), onKind: (value: string) => setKind(value) },
    } as const
}
