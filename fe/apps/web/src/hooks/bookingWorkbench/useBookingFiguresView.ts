"use client"

import { useFormatter, useTranslations } from "next-intl"
import type { useBookingBoard } from "@/hooks/bookingBoard"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** The view `useBookingFiguresView` returns. */
export interface BookingFiguresViewShape {
    readonly props: {
        readonly label: string
        readonly slot: DataSlot<
            {
                id: string
                term: string
                value: string
                meta: string
            }[]
        >
        readonly labels: SlotLabels
        readonly placeholder: {
            id: string
            term: string
            value: string
            meta: string
        }[]
    }
    readonly on: {
        readonly retry: () => Promise<
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
    }
}

/** Resolves the booking ribbon from its authoritative board while its workbench overview is mounted. */
export const useBookingFiguresView = (boardRead: ReturnType<typeof useBookingBoard>): BookingFiguresViewShape => {
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const { board, boardSlot, reload } = boardRead
    const f = board.figures
    const noShow = f.noShowPct30d === null ? "-" : `${f.noShowPct30d}%`
    const utilisation = f.utilisationPct === null ? "-" : `${f.utilisationPct}%`
    const deposits = format.number(f.depositsPendingVnd, {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
    })
    const items = [
        {
            id: "today",
            term: t("metricToday"),
            value: String(f.bookingsToday),
            meta: t("metricTodayBasis"),
        },
        {
            id: "noShow",
            term: t("metricNoShow"),
            value: noShow,
            meta: f.noShowPct30d === null ? t("metricNoShowNone") : t("metricNoShowBasis", { n: f.finished30d }),
        },
        {
            id: "utilisation",
            term: t("metricUtilisation"),
            value: utilisation,
            meta: f.utilisationPct === null ? t("metricUtilisationNone") : t("metricUtilisationBasis"),
        },
        {
            id: "deposits",
            term: t("metricDeposits"),
            value: String(f.depositsPending),
            meta: f.depositsPending === 0 ? t("metricDepositsNone") : t("metricDepositsBasis", { value: deposits }),
        },
    ]
    return {
        props: {
            label: t("tabCalendar"),
            slot: mapSlot(boardSlot, () => items),
            labels: slotLabels(t("loadFailedTitle")),
            placeholder: items,
        },
        on: { retry: reload },
    } as const
}
