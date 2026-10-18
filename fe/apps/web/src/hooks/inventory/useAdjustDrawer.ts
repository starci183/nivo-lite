"use client"

import { useAdjustmentPreview } from "./useAdjustmentPreview"
import type { InventoryCommandSet } from "@/hooks/inventoryCommands"
import type { ItemView, LocationView } from "@/modules/types"
import { useTranslations } from "next-intl"
import { num, type AdjustMode } from "./inventory.shared"
import { useDrawer, type DrawerControl } from "./useDrawer"
import { useInventoryFormat } from "./useInventoryFormat"
import { useInventoryRun } from "./useInventoryRun"
import { useSay } from "./useSay"

/** The quantity drawer while it is open: the item and what was typed. */
export interface AdjustState {
    readonly item: ItemView
    readonly mode: AdjustMode
    readonly value: string
    readonly reason: string
    readonly from: string
    readonly to: string
}

const modeOf = (value: string): AdjustMode => (value === "delta" || value === "move" ? value : "set")

/** Opens, fills and applies the quantity form (set, change or move); `props` is null while the drawer is closed. */
export const useAdjustDrawer = (
    locations: ReadonlyArray<LocationView>,
    defaultLocationId: string | null,
    commands: InventoryCommandSet<"adjustStock" | "transferStock">,
) => {
    const t = useTranslations("workbenchInventory")
    const say = useSay()
    const run = useInventoryRun()
    const drawer = useDrawer<AdjustState>()
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
                drawer.done,
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
            (result) => (result.state === "applied" ? drawer.done() : t("adjustWaiting")),
        )
    }
    const { format, effect } = useAdjustmentPreview(state, several)
    return viewOf({
        drawer,
        defaultLocationId,
        state,
        effect,
        say,
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
/** The resolved inputs for adjustment view input. */
interface AdjustmentViewInput {
    readonly drawer: DrawerControl<AdjustState>
    readonly defaultLocationId: string | null
    readonly state: AdjustState | null
    readonly effect: {
        current: number
        target: number
        delta: number
        small: boolean
        move: boolean
        submitKey: string
    } | null
    readonly say: ReturnType<typeof useSay>
    readonly t: ReturnType<typeof useTranslations<"workbenchInventory">>
    readonly format: ReturnType<typeof useInventoryFormat>
    readonly several: boolean
    readonly nameOf: (id: string) => string
    readonly places: { id: string; label: string }[]
    readonly run: ReturnType<typeof useInventoryRun>
    readonly patch: (next: Partial<AdjustState>) => void
    readonly submit: (open: AdjustState) => void
}

const viewOf = ({
    drawer,
    defaultLocationId,
    state,
    effect,
    say,
    t,
    format,
    several,
    nameOf,
    places,
    run,
    patch,
    submit,
}: AdjustmentViewInput) => {
    const placeSummary =
        state?.item.levels.map((level) => `${nameOf(level.locationId)} ${format.qty(level.qty)}`).join(" · ") ?? ""
    const previewKey = effect?.small ? "adjustPreviewSmall" : "adjustPreviewBig"
    return {
        open: (item: ItemView) =>
            drawer.open({ item, mode: "set", value: "", reason: "", from: defaultLocationId ?? "", to: "" }),
        props:
            state === null || effect === null
                ? null
                : {
                      say,
                      itemName: state.item.name,
                      unit: state.item.unit,
                      summary: t("adjustSummary", {
                          total: format.qty(state.item.total),
                          unit: state.item.unit,
                          places: several ? ` · ${placeSummary}` : "",
                      }),
                      modes: [
                          { value: "set", label: t("adjustSet") },
                          { value: "delta", label: t("adjustDelta") },
                          ...(several ? [{ value: "move", label: t("adjustMoveMode") }] : []),
                      ],
                      mode: state.mode,
                      isMove: effect.move,
                      showPlaces: several,
                      places,
                      targets: places.filter((place) => place.id !== state.from),
                      from: state.from,
                      to: state.to,
                      value: state.value,
                      reason: state.reason,
                      preview:
                          state.value.trim() !== "" && !effect.move
                              ? t(previewKey, {
                                    from: format.qty(effect.current),
                                    to: format.qty(effect.target),
                                    unit: state.item.unit,
                                    value: format.money(Math.abs(effect.delta) * state.item.costVnd),
                                })
                              : null,
                      submitLabel: t(effect.submitKey),
                      canSubmit: state.value.trim() !== "" && !(effect.move && state.to === ""),
                      isPending: run.isPending,
                      error: run.error,
                      notice: run.notice,
                  },
        on: {
            mode: (next: string) => patch({ mode: modeOf(next) }),
            from: (from: string) => patch({ from }),
            to: (to: string) => patch({ to }),
            value: (value: string) => patch({ value }),
            reason: (reason: string) => patch({ reason }),
            submit: () => {
                if (state !== null) submit(state)
            },
            close: drawer.close,
        },
    }
}
