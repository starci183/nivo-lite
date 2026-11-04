"use client"

import { adjustmentCopyOf, type InventoryPanelScope, num } from "./inventory.shared"
import { adjustmentViewOf, type AdjustMode, type AdjustState } from "@/hooks/inventoryAdjustView"
import { useAdjustmentPreview } from "./useAdjustmentPreview"
import type { InventoryCommandSet } from "@/hooks/inventoryCommands"
import type { ItemView, LocationView } from "@/modules/types"
import { useTranslations } from "next-intl"
import { useDrawer } from "./useDrawer"
import { useInventoryRun } from "./useInventoryRun"
import { useSay } from "./useSay"

/** The view `useAdjustDrawer` returns. */
export interface AdjustDrawerView {
    open: (item: ItemView) => void
    props: {
        copy: {
            readonly adjustTitle: string
            readonly close: string
            readonly adjustMode: string
            readonly adjustFrom: string
            readonly adjustAt: string
            readonly adjustTo: string
            readonly adjustToHint: string
            readonly adjustNote: string
            readonly adjustReason: string
            readonly adjustReasonHint: string
            readonly valueLabel: string
        }
        itemName: string
        unit: string
        summary: string
        modes: {
            value: string
            label: string
        }[]
        mode: AdjustMode
        isMove: boolean
        showPlaces: boolean
        places: {
            id: string
            label: string
        }[]
        targets: {
            id: string
            label: string
        }[]
        from: string
        to: string
        value: string
        reason: string
        preview: string | null
        submitLabel: string
        canSubmit: boolean
        isPending: boolean
        error: string | null
        notice: string | null
    } | null
    on: {
        mode: (next: string) => void
        from: (from: string) => void
        to: (to: string) => void
        value: (value: string) => void
        reason: (reason: string) => void
        submit: () => void
        close: () => void
    }
}

/** Opens, fills and applies the quantity form (set, change or move); `props` is null while the drawer is closed. */
export const useAdjustDrawer = (
    locations: ReadonlyArray<LocationView>,
    defaultLocationId: string | null,
    commands: InventoryCommandSet<"adjustStock" | "transferStock">,
    lifetime?: InventoryPanelScope,
): AdjustDrawerView => {
    const { isActive = true, scope = "" } = lifetime ?? {}

    const t = useTranslations("workbenchInventory")
    const say = useSay()
    const run = useInventoryRun(isActive, scope)
    const drawer = useDrawer<AdjustState>(isActive, scope)
    const { state } = drawer
    const patch = (next: Partial<AdjustState>) => drawer.change((current) => ({ ...current, ...next }))
    const several = locations.length > 1
    const places = locations.map((location) => ({ id: location.id, label: location.name }))
    const nameOf = (id: string): string => locations.find((location) => location.id === id)?.name ?? ""
    const submit = (open: AdjustState) => {
        if (open.mode === "move") {
            run.exec(
                () =>
                    commands.transferStock({
                        itemId: open.item.id,
                        fromLocationId: open.from,
                        toLocationId: open.to,
                        qty: num(open.value),
                        note: open.reason,
                    }),
                drawer.finish,
            )
            return
        }
        const amount = open.mode === "set" ? { counted: num(open.value) } : { delta: num(open.value) }
        run.exec(
            () =>
                commands.adjustStock({
                    itemId: open.item.id,
                    ...(open.from === "" ? {} : { locationId: open.from }),
                    ...amount,
                    reason: open.reason,
                }),
            (result, isCurrent) => {
                if (result.state !== "applied") return t("adjustWaiting")
                if (isCurrent()) drawer.done()
                return undefined
            },
        )
    }
    const { format, effect } = useAdjustmentPreview(state, several)
    return adjustmentViewOf({
        drawer,
        defaultLocationId,
        state,
        effect,
        copyOf: (state) => adjustmentCopyOf(say, state),
        t,
        format,
        several,
        nameOf,
        places,
        run,
        patch,
        submit,
    })
}
