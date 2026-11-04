"use client"

import type { useBookingBoard } from "@/hooks/bookingBoard"
import { useFeatureReset } from "@/hooks/reuseables"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import {
    buildBookingResourcesState,
    useBookingCatalogEditor,
    useBookingResourceCommands,
    type ResourceDraft,
    type ResourceNotice,
} from "@/hooks/bookingSetup"
import {
    bookingResourcesOn,
    bookingResourcesProps,
    type BookingResourcesOn,
    type BookingResourcesProps,
} from "@/hooks/bookingResourcesView"

/** The view `useBookingResourcesView` returns. */
export interface BookingResourcesView {
    readonly props: BookingResourcesProps
    readonly on: BookingResourcesOn
}

/** Draws the connected view from its current state. */
export const useBookingResourcesView = (
    isActive: boolean,
    scope: string,
    boardRead: ReturnType<typeof useBookingBoard>,
): BookingResourcesView => {
    const { board } = boardRead
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const commands = useBookingResourceCommands()
    const { draft, setDraft, removeId, setRemoveId, isPending, startTransition } =
        useBookingCatalogEditor<ResourceDraft>(isActive, scope)
    const [notice, setNotice] = useState<ResourceNotice | null>(null)
    useFeatureReset({
        isActive: isActive,
        isReady: true,
        scope: scope,
        onReset: () => {
            setNotice(null)
        },
    })

    const connected = buildBookingResourcesState({
        board,
        removeId,
        format,
        draft,
        startTransition,
        commands,
        setDraft,
        setNotice,
        t,
        isPending,
        notice,
        setRemoveId,
    })

    return {
        props: { ...bookingResourcesProps(connected), isPending: connected.isPending },
        on: { ...bookingResourcesOn(connected) },
    } as const
}
