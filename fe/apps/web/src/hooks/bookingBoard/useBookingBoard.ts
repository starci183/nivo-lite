import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { useQueryBookingBoardSwr } from "@/hooks/swr"
import { toBookingBoard, EMPTY_BOOKING_BOARD } from "./bookingBoard.shared"
import { readError } from "@/hooks/workspaceread"
import type { BookingBoard, DataSlot } from "@/modules/types"
import type { SWRResponse } from "swr"

/** The view `useBookingBoard` returns. */
export interface BookingBoardView {
    board: BookingBoard
    isLoaded: boolean
    /** The read as a slot, for a block that draws the board through SlotView. */
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
    boardSlot: DataSlot<BookingBoard>
    slot: DataSlot<true>
    isFailed: boolean
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
}

/** The booking board of the active workspace for the setup and statistics tabs: the empty board until the answer arrives, `isFailed` when it could not be read. */
export const useBookingBoard = (isActive = true): BookingBoardView => {
    const swrRead = useQueryBookingBoardSwr({}, { keepPreviousData: true }, isActive)
    const { data } = swrRead
    const error = readError(swrRead)
    return {
        board: data === undefined ? EMPTY_BOOKING_BOARD : toBookingBoard(data),
        isLoaded: data !== undefined,
        /** The read as a slot, for a block that draws the board through SlotView. */
        read: swrRead,
        boardSlot: mapSlot(slotOfSwr(swrRead), toBookingBoard),
        slot: mapSlot(slotOfSwr(swrRead), () => true as const),
        isFailed: error !== undefined,
        reload: () => swrRead.mutate(),
    }
}
