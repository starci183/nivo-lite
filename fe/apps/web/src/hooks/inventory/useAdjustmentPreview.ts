"use client"

import { isSmallAdjustment, num } from "./inventory.shared"
import { useInventoryFormat } from "./useInventoryFormat"
import type { AdjustState } from "./useAdjustDrawer"

/** Resolves the quantity effect and its locale formatting for the adjustment preview. */
export const useAdjustmentPreview = (state: AdjustState | null, several: boolean) => {
    const format = useInventoryFormat()
    const effect = state === null ? null : effectOf(state, several)
    return { format, effect }
}

/** What the typed value would do to the level: where it goes, whether it is small, and the text of the button. */
const effectOf = (open: AdjustState, several: boolean) => {
    const { item } = open
    const here = item.levels.find((level) => level.locationId === open.from)?.qty ?? 0
    const current = several ? here : item.total
    const target = open.mode === "set" ? num(open.value, current) : current + num(open.value)
    const delta = target - current
    const small = isSmallAdjustment(delta, item.costVnd)
    const changeKey = small ? "adjustApply" : "adjustAsk"
    return {
        current,
        target,
        delta,
        small,
        move: open.mode === "move",
        submitKey: open.mode === "move" ? "adjustMove" : changeKey,
    }
}
