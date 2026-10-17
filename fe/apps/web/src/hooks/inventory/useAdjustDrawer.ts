"use client"

import type { InventoryCommandSet } from "@/hooks/inventoryCommands"
import type { ItemView, LocationView } from "@/modules/types"
import { useTranslations } from "next-intl"
import { isSmallAdjustment, num } from "./inventory.shared"
import type { AdjustMode } from "./inventory.shared"
import { useDrawer } from "./useDrawer"
import type { DrawerControl } from "./useDrawer"
import { useInventoryFormat } from "./useInventoryFormat"
import { useInventoryRun } from "./useInventoryRun"
import { useSay } from "./useSay"

/** The quantity drawer while it is open: the item and what was typed. */
interface AdjustState {
    readonly item: ItemView
    readonly mode: AdjustMode
    readonly value: string
    readonly reason: string
    readonly from: string
    readonly to: string
}

const modeOf = (value: string): AdjustMode => (value === "delta" || value === "move" ? value : "set")

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

/** Opens, fills and applies the quantity form (set, change or move); `props` is null while the drawer is closed. */
export const useAdjustDrawer = (
    locations: ReadonlyArray<LocationView>,
    defaultLocationId: string | null,
    commands: InventoryCommandSet<"adjustStock" | "transferStock">,
) => {
    const t = useTranslations("workbenchInventory")
    const format = useInventoryFormat()
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
    const effect = state === null ? null : effectOf(state, several)
    return viewOf(drawer, defaultLocationId, state, effect, say, t, format, several, nameOf, places, run, patch, submit)
}

const viewOf = (
    drawer: DrawerControl<AdjustState>,
    defaultLocationId: string | null,
    state: AdjustState | null,
    effect: { current: number; target: number; delta: number; small: boolean; move: boolean; submitKey: string } | null,
    say: ReturnType<typeof useSay>,
    t: ReturnType<typeof useTranslations<"workbenchInventory">>,
    format: ReturnType<typeof useInventoryFormat>,
    several: boolean,
    nameOf: (id: string) => string,
    places: { id: string; label: string }[],
    run: ReturnType<typeof useInventoryRun>,
    patch: (next: Partial<AdjustState>) => void,
    submit: (open: AdjustState) => void,
) => {
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
                          places: several
                              ? ` · ${state.item.levels.map((level) => `${nameOf(level.locationId)} ${format.qty(level.qty)}`).join(" · ")}`
                              : "",
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
                              ? t(effect.small ? "adjustPreviewSmall" : "adjustPreviewBig", {
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
