"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { MOVE_KINDS, MOVE_TONES, includesText } from "@/hooks/inventory"
import { useInventoryFormat } from "@/hooks/inventory"
import type { MovementView } from "@/modules/types"
import { InventoryHistoryBase } from "./component"

/** The movements of the history. */
interface InventoryHistoryProps {
    readonly movements: ReadonlyArray<MovementView>
}

const ALL = "all"

/** The history tab: the search text and the movement kind live here, the drawing in the pure half. */
export const InventoryHistory = (props: InventoryHistoryProps) => {
    const t = useTranslations("workbenchInventory")
    const format = useInventoryFormat()
    const [query, setQuery] = useState("")
    const [kind, setKind] = useState(ALL)
    const kindName = (value: string): string => (MOVE_KINDS.includes(value) ? t(`move_${value}`) : value)
    const rows = props.movements.filter(
        (movement) =>
            (kind === ALL || movement.kind === kind) &&
            includesText(`${movement.itemName} ${movement.reason} ${movement.refLabel ?? ""}`, query),
    )
    return (
        <InventoryHistoryBase
            props={{
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
            }}
            on={{ query: setQuery, kind: setKind }}
        />
    )
}
