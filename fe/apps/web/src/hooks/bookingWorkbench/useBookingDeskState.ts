"use client"

import { useFeatureReset } from "@/hooks/reuseables"
import { useState, type Dispatch, type SetStateAction } from "react"
import type { useTranslations, useFormatter } from "next-intl"
import {
    actionsOf,
    blankPlacementOf,
    useBookingRange,
    useBookingActions,
    useBookingPlacement,
    type PlacementDraft,
    type PlacementFields,
    type DeskNotice,
} from "@/hooks/bookingDesk"
import { EMPTY_BOOKING_BOARD } from "@/hooks/bookingBoard"
import { buildBookingDeskDisplay } from "@/hooks/bookingDeskView"
import type { BookingAction, BookingBoard, BookingView, BookingServiceView } from "@/modules/types"
import type { SWRResponse } from "swr"

/** Inputs owned by this display/state mapping. */
interface BuildBookingDeskStateInput {
    readonly range: ReturnType<typeof useBookingRange> & {
        readonly board: NonNullable<ReturnType<typeof useBookingRange>["board"]>
    }
    readonly mode: "week" | "today"
    readonly t: ReturnType<typeof useTranslations<"workbenchBooking">>
    readonly format: ReturnType<typeof useFormatter>
    readonly showCancelled: boolean
    readonly openId: string | null
    readonly cancelId: string | null
    readonly desk: ReturnType<typeof useBookingActions>
    readonly place: ReturnType<typeof useBookingPlacement>
    readonly setCancelId: import("react").Dispatch<import("react").SetStateAction<string | null>>
    readonly setOpenId: import("react").Dispatch<import("react").SetStateAction<string | null>>
    readonly setShowCancelled: import("react").Dispatch<import("react").SetStateAction<boolean>>
}

/** Connects booking data, placement state and agenda commands. */
const buildBookingDeskState = ({
    range,
    mode,
    t,
    format,
    showCancelled,
    openId,
    cancelId,
    desk,
    place,
    setCancelId,
    setOpenId,
    setShowCancelled,
}: BuildBookingDeskStateInput) => {
    const { board } = range
    const isToday = mode === "today"
    const display = buildBookingDeskDisplay({
        board,
        anchorValue: range.anchor,
        t,
        format,
        isToday,
        showCancelled,
        openId,
        cancelId,
        placement: blankPlacementOf,
        loadingSuffix: range.isValidating ? ` · ${t("loadingRange")}` : "",
    })
    const openAdd = () => {
        if (display.activeServices.length === 0) return desk.announce("addNoServices", "negative")
        place.open({ kind: "add" }, display.blank)
    }
    const openMove = (id: string) => {
        const booking = board.bookings.find((candidate) => candidate.id === id)
        if (booking === undefined) return
        place.open(
            { kind: "move", id },
            {
                ...display.blank,
                serviceId: booking.serviceId,
                date: booking.date,
                time: booking.startClock,
                resourceId: booking.resourceId,
            },
        )
    }
    const act = (id: string, action: string) => {
        const booking = board.bookings.find((candidate) => candidate.id === id)
        const chosen = booking && actionsOf(booking.status, booking.checkedIn).find((candidate) => candidate === action)
        if (chosen === "cancel") setCancelId(id)
        else if (chosen !== undefined) desk.act(id, chosen, () => setOpenId(null))
    }
    return {
        ...display,
        t,
        place,
        isToday,
        desk,
        range,
        openAdd,
        board,
        setShowCancelled,
        setOpenId,
        act,
        cancelId,
        setCancelId,
        openMove,
    }
}
/** The active calendar/today desk identity and its already resolved locale readers. */
interface BookingDeskStateInput {
    readonly mode: BuildBookingDeskStateInput["mode"]
    readonly isActive: boolean
    readonly scope: string
    readonly t: ReturnType<typeof useTranslations<"workbenchBooking">>
    readonly format: ReturnType<typeof useFormatter>
}
/** The view `useBookingDeskState` returns. */
export interface BookingDeskStateView {
    t: ReturnType<typeof useTranslations<"workbenchBooking">>
    place: {
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
    isToday: boolean
    desk: {
        notice: DeskNotice | null
        isBusy: boolean
        dismiss: () => void
        announce: (code: string, tone?: DeskNotice["tone"]) => void
        act: (id: string, action: BookingAction, finish: () => void) => void
    }
    range: {
        read: SWRResponse<
            {
                from: string
                nowMs: number
                timezone: string
                to: string
                today: string
                bookings: Array<{
                    checkedIn: boolean
                    conflictNote: string
                    customer: string
                    date: string
                    depositStatus: string
                    depositVnd: number
                    endClock: string
                    endMin: number
                    endMs: number
                    feeVnd: number
                    holdsSlot: boolean
                    id: string
                    leadId: string | null
                    note: string
                    party: number
                    phone: string | null
                    priceVnd: number | null
                    reschedules: number
                    resourceId: string
                    service: string
                    serviceId: string
                    source: string
                    startClock: string
                    startMin: number
                    startMs: number
                    status: string
                }>
                exceptions: Array<{
                    closed: boolean
                    date: string
                    end: string | null
                    id: string
                    note: string
                    resourceId: string | null
                    start: string | null
                }>
                figures: {
                    bookingsToday: number
                    depositsPending: number
                    depositsPendingVnd: number
                    finished30d: number
                    noShowPct30d: number | null
                    utilisationPct: number | null
                }
                hours: Array<{
                    end: string
                    resourceId: string
                    start: string
                    weekday: number
                }>
                resources: Array<{
                    active: boolean
                    capacity: number
                    color: string
                    id: string
                    kind: string
                    name: string
                    sort: number
                    staffId: string | null
                }>
                services: Array<{
                    active: boolean
                    bufferMin: number
                    description: string
                    durationMin: number
                    followupDays: number | null
                    id: string
                    name: string
                    priceVnd: number | null
                    resourceKind: string | null
                }>
                settings: {
                    address: string
                    autoConfirm: boolean
                    cancelWindowHours: number
                    depositPct: number
                    handoffOrder: boolean
                    lateCancelFeePct: number
                    maxAdvanceDays: number
                    minLeadMin: number
                    noShowFeeVnd: number
                    publicEnabled: boolean
                    publicNote: string
                    publicSlug: string | null
                    reminderHours: Array<number>
                    slotStepMin: number
                    timezone: string
                }
                staff: Array<{
                    id: string
                    name: string
                }>
                stats: {
                    doneRevenueVnd: number
                    noShowPct: number
                    total: number
                    byResource: Array<{
                        bookedMin: number
                        name: string
                        openMin: number
                        pct: number
                        resourceId: string
                    }>
                    byStatus: Array<{
                        count: number
                        status: string
                    }>
                }
                waitlist: Array<{
                    customer: string
                    fromMs: number
                    id: string
                    party: number
                    phone: string | null
                    service: string
                    status: string
                    toMs: number
                }>
            },
            Error
        >
        board: BookingBoard | undefined
        anchor: string
        failed: boolean
        isLoading: boolean
        isValidating: boolean
        goto: (date: string) => void
        reload: () => Promise<
            | {
                  from: string
                  nowMs: number
                  timezone: string
                  to: string
                  today: string
                  bookings: Array<{
                      checkedIn: boolean
                      conflictNote: string
                      customer: string
                      date: string
                      depositStatus: string
                      depositVnd: number
                      endClock: string
                      endMin: number
                      endMs: number
                      feeVnd: number
                      holdsSlot: boolean
                      id: string
                      leadId: string | null
                      note: string
                      party: number
                      phone: string | null
                      priceVnd: number | null
                      reschedules: number
                      resourceId: string
                      service: string
                      serviceId: string
                      source: string
                      startClock: string
                      startMin: number
                      startMs: number
                      status: string
                  }>
                  exceptions: Array<{
                      closed: boolean
                      date: string
                      end: string | null
                      id: string
                      note: string
                      resourceId: string | null
                      start: string | null
                  }>
                  figures: {
                      bookingsToday: number
                      depositsPending: number
                      depositsPendingVnd: number
                      finished30d: number
                      noShowPct30d: number | null
                      utilisationPct: number | null
                  }
                  hours: Array<{
                      end: string
                      resourceId: string
                      start: string
                      weekday: number
                  }>
                  resources: Array<{
                      active: boolean
                      capacity: number
                      color: string
                      id: string
                      kind: string
                      name: string
                      sort: number
                      staffId: string | null
                  }>
                  services: Array<{
                      active: boolean
                      bufferMin: number
                      description: string
                      durationMin: number
                      followupDays: number | null
                      id: string
                      name: string
                      priceVnd: number | null
                      resourceKind: string | null
                  }>
                  settings: {
                      address: string
                      autoConfirm: boolean
                      cancelWindowHours: number
                      depositPct: number
                      handoffOrder: boolean
                      lateCancelFeePct: number
                      maxAdvanceDays: number
                      minLeadMin: number
                      noShowFeeVnd: number
                      publicEnabled: boolean
                      publicNote: string
                      publicSlug: string | null
                      reminderHours: Array<number>
                      slotStepMin: number
                      timezone: string
                  }
                  staff: Array<{
                      id: string
                      name: string
                  }>
                  stats: {
                      doneRevenueVnd: number
                      noShowPct: number
                      total: number
                      byResource: Array<{
                          bookedMin: number
                          name: string
                          openMin: number
                          pct: number
                          resourceId: string
                      }>
                      byStatus: Array<{
                          count: number
                          status: string
                      }>
                  }
                  waitlist: Array<{
                      customer: string
                      fromMs: number
                      id: string
                      party: number
                      phone: string | null
                      service: string
                      status: string
                      toMs: number
                  }>
              }
            | undefined
        >
    } & {
        readonly board: NonNullable<ReturnType<typeof useBookingRange>["board"]>
    }
    openAdd: () => void
    board: BookingBoard
    setShowCancelled: Dispatch<SetStateAction<boolean>>
    setOpenId: Dispatch<SetStateAction<string | null>>
    act: (id: string, action: string) => void
    cancelId: string | null
    setCancelId: Dispatch<SetStateAction<string | null>>
    openMove: (id: string) => void
    words: {
        say: ReturnType<typeof useTranslations<"workbenchBooking">>
        resourceName: (id: string) => string
        money: (value: number) => string
    }
    dayText: (date: string) => string
    visible: BookingView[]
    open: BookingView | undefined
    cancelling: BookingView | undefined
    activeServices: BookingServiceView[]
    blank: PlacementFields
    resourceOptions: {
        id: string
        label: string
    }[]
    anchor: string
    nav: {
        prevLabel: string
        nextLabel: string
        thisWeekLabel: string
        dateLabel: string
        date: string
        showCancelledLabel: string
        showCancelled: boolean
        rangeText: string
    }
}

/** Owns the desk's actual range, selection, placement and command lifetime across Calendar and Today. */
export const useBookingDeskState = (input: BookingDeskStateInput): BookingDeskStateView => {
    const { t, format } = input
    const range = useBookingRange(input.isActive, input.scope)

    const desk = useBookingActions(() => range.reload(), input.isActive, input.scope)

    const [openId, setOpenId] = useState<string | null>(null)

    const place = useBookingPlacement(
        range.board?.timezone ?? "",
        () => {
            setOpenId(null)
            return range.reload()
        },
        input.isActive,
        input.scope,
    )

    const [cancelId, setCancelId] = useState<string | null>(null)

    const [showCancelled, setShowCancelled] = useState(false)

    useFeatureReset({
        isActive: input.isActive,
        isReady: true,
        scope: input.scope,
        onReset: () => {
            setOpenId(null)
            setCancelId(null)
            setShowCancelled(false)
        },
    })

    const connected = buildBookingDeskState({
        range: { ...range, board: range.board ?? EMPTY_BOOKING_BOARD },
        mode: input.mode,
        t,
        format,
        showCancelled,
        openId,
        cancelId,
        desk,
        place,
        setCancelId,
        setOpenId,
        setShowCancelled,
    })
    return connected
}
