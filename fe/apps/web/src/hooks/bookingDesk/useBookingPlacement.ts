import { useState, useTransition } from "react"
import { wallInstant } from "@/modules/i18n"
import type { BookingAddInput, BookingMoveInput, BookingPlacement } from "@/modules/types"

type Outcome<T> =
    | { readonly kind: "ok"; readonly value: T }
    | { readonly kind: "refused" | "not-found" | "invalid" | "unavailable"; readonly code: string }

/** The two calls the placement dialog makes; the connected block owns the server actions and hands them in. */
export interface BookingPlacementActions {
    readonly add: (input: BookingAddInput) => Promise<Outcome<BookingPlacement>>
    readonly move: (input: BookingMoveInput) => Promise<Outcome<BookingPlacement>>
}

/** The fields of the dialog. */
export interface PlacementFields {
    readonly serviceId: string
    readonly date: string
    readonly time: string
    readonly resourceId: string
    readonly name: string
    readonly phone: string
    readonly party: number
    readonly note: string
    readonly force: boolean
}

/** Which command the dialog is for; a move names the booking. */
export type PlacementDraft = { readonly kind: "add" } | { readonly kind: "move"; readonly id: string }

/** Refusals the owner may override by stacking the booking anyway. */
const FORCEABLE: ReadonlyArray<string> = ["closed", "full", "taken", "no_resource"]

/** The reasons the database gives that are shown as they are; any other becomes the generic failure. */
const REASONS: ReadonlyArray<string> = [
    "service_required",
    "name_required",
    "datetime_invalid",
    "service_not_found",
    "closed",
    "full",
    "no_resource",
    "taken",
    "not_movable",
    "resource_not_found",
]

/** The owner's add and move of a booking: one dialog, one set of fields, and the refusal reason kept on screen until the owner changes the plan. */
export const useBookingPlacement = (
    workspaceId: string,
    timezone: string,
    actions: BookingPlacementActions,
    onPlaced: (kind: PlacementDraft["kind"]) => void,
) => {
    const [draft, setDraft] = useState<PlacementDraft | null>(null)
    const [fields, setFields] = useState<PlacementFields | null>(null)
    const [reason, setReason] = useState<string | null>(null)
    const [isBusy, startTransition] = useTransition()

    const close = () => {
        setDraft(null)
        setFields(null)
        setReason(null)
    }

    const submit = () => {
        if (draft === null || fields === null) return
        startTransition(async () => {
            const answer =
                draft.kind === "add"
                    ? await actions.add({
                          workspaceId,
                          serviceId: fields.serviceId,
                          date: fields.date,
                          time: fields.time,
                          resourceId: fields.resourceId,
                          name: fields.name,
                          phone: fields.phone,
                          party: fields.party,
                          note: fields.note,
                          force: fields.force,
                      })
                    : await actions.move({
                          workspaceId,
                          id: draft.id,
                          startAt: new Date(wallInstant(fields.date, fields.time, timezone)).toISOString(),
                          resourceId: fields.resourceId,
                          force: fields.force,
                      })
            if (answer.kind !== "ok") return setReason("failed")
            if (!answer.value.ok) return setReason(REASONS.find((known) => known === answer.value.reason) ?? "failed")
            const kind = draft.kind
            close()
            onPlaced(kind)
        })
    }

    return {
        draft,
        fields,
        reason,
        isBusy,
        canForce: reason !== null && FORCEABLE.includes(reason),
        open: (next: PlacementDraft, start: PlacementFields) => {
            setReason(null)
            setFields(start)
            setDraft(next)
        },
        change: (patch: Partial<PlacementFields>) => {
            if (!("force" in patch)) setReason(null)
            setFields((before) => (before === null ? before : { ...before, ...patch }))
        },
        submit,
        close,
    }
}
