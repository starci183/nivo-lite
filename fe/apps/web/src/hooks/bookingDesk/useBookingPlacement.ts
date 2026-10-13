"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { useSWRConfig } from "swr"
import { QUERY_BOOKING_BOARD_SWR_KEY, useMutateAddBookingSwr, useMutateMoveBookingSwr } from "@/hooks/swr"
import { matchesSwrKey } from "@/modules/utils"
import { graphQLErrorCode } from "@/modules/api"
import { wallInstant } from "@/modules/i18n"
import { toast } from "@/modules/toast"

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

/** The owner's add and move of a booking: one dialog, one set of fields, and the refusal reason kept on screen until the owner changes the plan. A placed booking toasts and revalidates every cached board. */
export const useBookingPlacement = (timezone: string, onPlaced: (kind: PlacementDraft["kind"]) => void) => {
    const t = useTranslations("workbenchBooking")
    const tToast = useTranslations("toast")
    const { mutate } = useSWRConfig()
    const add = useMutateAddBookingSwr()
    const move = useMutateMoveBookingSwr()
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
            try {
                if (draft.kind === "add") {
                    await add.trigger({
                        serviceId: fields.serviceId,
                        date: fields.date,
                        time: fields.time,
                        resourceId: fields.resourceId === "" ? null : fields.resourceId,
                        name: fields.name,
                        phone: fields.phone === "" ? null : fields.phone,
                        party: fields.party,
                        note: fields.note === "" ? null : fields.note,
                        force: fields.force,
                    })
                } else {
                    await move.trigger({
                        id: draft.id,
                        startAt: new Date(wallInstant(fields.date, fields.time, timezone)).toISOString(),
                        resourceId: fields.resourceId,
                        force: fields.force,
                    })
                }
            } catch (error) {
                const code = graphQLErrorCode(error)
                setReason(code === undefined ? "failed" : (REASON_OF_CODE[code] ?? "failed"))
                return
            }
            toast.success(tToast("successTitle"), {
                description: t(draft.kind === "add" ? "did_add" : "did_move"),
            })
            const kind = draft.kind
            close()
            void mutate(matchesSwrKey(QUERY_BOOKING_BOARD_SWR_KEY))
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
