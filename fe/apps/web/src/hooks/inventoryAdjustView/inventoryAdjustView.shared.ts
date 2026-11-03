import type { useTranslations } from "next-intl"
import type { ItemView } from "@/modules/types"

/** How a quantity is changed: set to a number, moved by a difference, or moved to another place. */
export type AdjustMode = "set" | "delta" | "move"

/** The quantity drawer while it is open: the item and what was typed. */
export interface AdjustState {
    readonly item: ItemView
    readonly mode: AdjustMode
    readonly value: string
    readonly reason: string
    readonly from: string
    readonly to: string
}

/** The number readers the drawer words its preview with. */
interface AdjustFormat {
    readonly qty: (value: number) => string
    readonly money: (value: number) => string
}

/** The state of the command the drawer runs. */
interface AdjustRun {
    readonly isPending: boolean
    readonly error: string | null
    readonly notice: string | null
}

/** The way the drawer opens and closes. */
interface AdjustDrawer {
    readonly open: (next: AdjustState) => void
    readonly close: () => void
}

/** The mode a mode key stands for. */
const modeOf = (value: string): AdjustMode => (value === "delta" || value === "move" ? value : "set")

/** What `adjustmentCopyOf` returns. */
export interface AdjustmentCopyOfResult {
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

/** The resolved inputs for adjustment view input. */
export interface AdjustmentViewInput {
    readonly drawer: AdjustDrawer
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
    readonly copyOf: (state: AdjustState) => AdjustmentCopyOfResult
    readonly t: ReturnType<typeof useTranslations<"workbenchInventory">>
    readonly format: AdjustFormat
    readonly several: boolean
    readonly nameOf: (id: string) => string
    readonly places: { id: string; label: string }[]
    readonly run: AdjustRun
    readonly patch: (next: Partial<AdjustState>) => void
    readonly submit: (open: AdjustState) => void
}

/** What `adjustmentViewOf` returns. */
export type AdjustmentViewOfResult = {
    open: (item: ItemView) => void
    props: {
        copy: AdjustmentCopyOfResult
        itemName: string
        unit: string
        summary: string
        modes: { value: string; label: string }[]
        mode: AdjustMode
        isMove: boolean
        showPlaces: boolean
        places: { id: string; label: string }[]
        targets: { id: string; label: string }[]
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

/** The view of the quantity drawer: its open command, its props while it is open and its commands. */
export const adjustmentViewOf = ({
    drawer,
    defaultLocationId,
    state,
    effect,
    copyOf,
    t,
    format,
    several,
    nameOf,
    places,
    run,
    patch,
    submit,
}: AdjustmentViewInput): AdjustmentViewOfResult => {
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
                      copy: copyOf(state),
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
