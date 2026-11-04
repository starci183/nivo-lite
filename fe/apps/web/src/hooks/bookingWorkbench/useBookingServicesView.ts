"use client"

import type { useBookingBoard } from "@/hooks/bookingBoard"
import { useFormatter, useTranslations } from "next-intl"
import type { Dispatch, SetStateAction } from "react"
import { bookingServiceDigits } from "@/modules/booking-desk"
import type { useBookingTransition } from "@/hooks/bookingDesk"
import { useBookingCatalogEditor, useBookingServiceCommands } from "@/hooks/bookingSetup"
import {
    bookingServicesOn,
    bookingServicesProps,
    type BookingServicesOn,
    type BookingServicesProps,
    type ServicesConnected,
    type ServiceDraft,
} from "@/hooks/bookingServicesView"

/** The view `useBookingServicesView` returns. */
export interface BookingServicesView {
    readonly props: BookingServicesProps
    readonly on: BookingServicesOn
}

/** Inputs for the connected state mapping. */
interface BuildBookingServicesStateInput {
    readonly board: ReturnType<typeof useBookingBoard>["board"]
    readonly removeId: string | null
    readonly draft: ServiceDraft | null
    readonly startTransition: ReturnType<typeof useBookingTransition>["run"]
    readonly commands: ReturnType<typeof useBookingServiceCommands>
    readonly setDraft: Dispatch<SetStateAction<ServiceDraft | null>>
    readonly setRemoveId: Dispatch<SetStateAction<string | null>>
    readonly t: ReturnType<typeof useTranslations<"workbenchBooking">>
    readonly format: ReturnType<typeof useFormatter>
    readonly isPending: boolean
}

/** Derives display values and interactions from the supplied state. */
const buildBookingServicesState = ({
    board,
    removeId,
    draft,
    startTransition,
    commands,
    setDraft,
    setRemoveId,
    t,
    format,
    isPending,
}: BuildBookingServicesStateInput): ServicesConnected => {
    const removing = board.services.find((service) => service.id === removeId)
    const save = () => {
        if (draft === null) return
        const { fields } = draft
        startTransition(async (isCurrent) => {
            const answer = await commands.saveService({
                id: draft.id,
                name: fields.name,
                description: fields.description,
                durationMin: fields.durationMin,
                bufferMin: fields.bufferMin,
                priceVnd: bookingServiceDigits(fields.price),
                resourceKind: fields.resourceKind,
                followupDays: bookingServiceDigits(fields.followup),
                active: fields.active,
            })
            if (answer === undefined || !isCurrent()) return
            setDraft(null)
        })
    }
    const remove = () => {
        if (removeId === null) return
        startTransition(async (isCurrent) => {
            const answer = await commands.removeService({ id: removeId })
            if (answer === undefined || !isCurrent()) return
            setRemoveId(null)
        })
    }
    return { t, board, format, draft, removing, isPending, setDraft, setRemoveId, save, remove }
}

/** Draws the connected view from its current state. */
export const useBookingServicesView = (
    isActive: boolean,
    scope: string,
    boardRead: ReturnType<typeof useBookingBoard>,
): BookingServicesView => {
    const { board } = boardRead
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const commands = useBookingServiceCommands()
    const { draft, setDraft, removeId, setRemoveId, isPending, startTransition } =
        useBookingCatalogEditor<ServiceDraft>(isActive, scope)

    const connected = buildBookingServicesState({
        board,
        removeId,
        draft,
        startTransition,
        commands,
        setDraft,
        setRemoveId,
        t,
        format,
        isPending,
    })
    return {
        props: { ...bookingServicesProps(connected), isPending: connected.isPending },
        on: { ...bookingServicesOn(connected) },
    } as const
}
