"use client"

import { useFeatureReset } from "@/hooks/reuseables"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useSWRConfig } from "swr"
import { QUERY_BOOKING_BOARD_SWR_KEY, useMutateAddBookingSwr, useMutateMoveBookingSwr } from "@/hooks/swr"
import { matchesSwrKey } from "@/modules/utils"
import { graphQLErrorCode } from "@/modules/failure"
import { wallInstant } from "@/modules/i18n"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { useBookingTransition } from "./useBookingTransition"

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
const FORCEABLE: ReadonlySet<string> = new Set(["closed", "full", "taken", "no_resource"])

/** The `BOOKINGS_*` capability codes of the back end as the `reason_*` catalog keys the dialog shows. */
const REASON_OF_CODE: Readonly<Record<string, string>> = {
    BOOKINGS_SERVICE_REQUIRED: "service_required",
    BOOKINGS_NAME_REQUIRED: "name_required",
    BOOKINGS_DATETIME_INVALID: "datetime_invalid",
    BOOKINGS_SERVICE_NOT_FOUND: "service_not_found",
    BOOKINGS_CLOSED: "closed",
    BOOKINGS_FULL: "full",
    BOOKINGS_NO_RESOURCE: "no_resource",
    BOOKINGS_TAKEN: "taken",
    BOOKINGS_NOT_MOVABLE: "not_movable",
    BOOKINGS_RESOURCE_NOT_FOUND: "resource_not_found",
    BOOKINGS_PHONE_INVALID: "phone_invalid",
}

/** The exact add/move payload belongs to the placement command, independently of its UI settlement. */
interface PlacementWrite {
    readonly draft: PlacementDraft
    readonly fields: PlacementFields
    readonly timezone: string
    readonly add: ReturnType<typeof useMutateAddBookingSwr>
    readonly move: ReturnType<typeof useMutateMoveBookingSwr>
}
const triggerPlacement = (input: PlacementWrite) => {
    if (input.draft.kind === "add") {
        return input.add.trigger({
            serviceId: input.fields.serviceId,
            date: input.fields.date,
            time: input.fields.time,
            resourceId: input.fields.resourceId === "" ? null : input.fields.resourceId,
            name: input.fields.name,
            phone: input.fields.phone === "" ? null : input.fields.phone,
            party: input.fields.party,
            note: input.fields.note === "" ? null : input.fields.note,
            force: input.fields.force,
        })
    } else {
        return input.move.trigger({
            id: input.draft.id,
            startAt: new Date(wallInstant(input.fields.date, input.fields.time, input.timezone)).toISOString(),
            resourceId: input.fields.resourceId,
            force: input.fields.force,
        })
    }
}

/** The view `useBookingPlacement` returns. */
export interface BookingPlacementView {
    draft: PlacementDraft | null
    fields: PlacementFields | null
    reason: string | null
    isBusy: boolean
    canForce: boolean
    open: (next: PlacementDraft, start: PlacementFields) => void
    change: (patch: Partial<PlacementFields>) => void
    submit: () => void
    close: () => void
}

/** The owner's add and move of a booking: one dialog, one set of fields, and the refusal reason kept on screen until the owner changes the plan. A placed booking toasts and revalidates every cached board. */
export const useBookingPlacement = (
    timezone: string,
    onPlaced: (kind: PlacementDraft["kind"]) => Promise<unknown>,
    isActive = true,
    scope = "",
): BookingPlacementView => {
    const t = useTranslations("workbenchBooking")
    const tToast = useTranslations("toast")
    const withToast = useGraphQLWithToast()
    const { mutate } = useSWRConfig()
    const add = useMutateAddBookingSwr()
    const move = useMutateMoveBookingSwr()
    const [draft, setDraft] = useState<PlacementDraft | null>(null)
    const [fields, setFields] = useState<PlacementFields | null>(null)
    const [reason, setReason] = useState<string | null>(null)
    const transition = useBookingTransition(isActive, scope)
    useFeatureReset({
        isActive: isActive,
        isReady: true,
        scope: scope,
        onReset: () => {
            setDraft(null)
            setFields(null)
            setReason(null)
        },
    })

    const close = () => {
        setDraft(null)
        setFields(null)
        setReason(null)
    }

    const submit = () => {
        if (draft === null || fields === null) return
        transition.run(async (isCurrent) => {
            try {
                await triggerPlacement({ draft, fields, timezone, add, move })
            } catch (error) {
                const code = graphQLErrorCode(error)
                if (isCurrent()) setReason(code === undefined ? "failed" : (REASON_OF_CODE[code] ?? "failed"))
                return
            }
            toast.success(tToast("successTitle"), {
                description: t(draft.kind === "add" ? "did_add" : "did_move"),
            })
            const kind = draft.kind
            if (isCurrent()) close()
            await withToast(
                () =>
                    Promise.all([
                        mutate(matchesSwrKey(QUERY_BOOKING_BOARD_SWR_KEY)),
                        ...(isCurrent() ? [onPlaced(kind)] : []),
                    ]),
                { showSuccessToast: false },
            )
        })
    }

    return {
        draft,
        fields,
        reason,
        isBusy: transition.isPending,
        canForce: reason !== null && FORCEABLE.has(reason),
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
