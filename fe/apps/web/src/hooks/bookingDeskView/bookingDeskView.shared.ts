import type { BadgeTone } from "@starci/grammar/common"
import type { useTranslations, useFormatter } from "next-intl"
import { type useBookingRange, type blankPlacementOf, type PlacementFields } from "@/hooks/bookingDesk"
import type { BookingView, BookingServiceView } from "@/modules/types"

/** Inputs owned by this display/state mapping. */
interface BookingDeskDisplayInput {
    readonly workspaceId: string
    readonly board: NonNullable<ReturnType<typeof useBookingRange>["board"]>
    readonly anchorValue: string
    readonly t: ReturnType<typeof useTranslations<"workbenchBooking">>
    readonly format: ReturnType<typeof useFormatter>
    readonly isToday: boolean
    readonly showCancelled: boolean
    readonly openId: string | null
    readonly cancelId: string | null
    readonly placement: typeof blankPlacementOf
    readonly loadingSuffix: string
}

/** What `buildBookingDeskDisplay` returns. */
export interface BuildBookingDeskDisplayResult {
    words: {
        say: ReturnType<typeof useTranslations<"workbenchBooking">>
        resourceName: (id: string) => string
        money: (value: number) => string
        workspaceId: string
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

/** Derives the visible booking agenda and localized navigation. */
export const buildBookingDeskDisplay = ({
    workspaceId,
    board,
    anchorValue,
    t,
    format,
    isToday,
    showCancelled,
    openId,
    cancelId,
    placement,
    loadingSuffix,
}: BookingDeskDisplayInput): BuildBookingDeskDisplayResult => {
    const words = {
        say: t,
        resourceName: (id: string) => board.resources.find((resource) => resource.id === id)?.name ?? "",
        money: (value: number) =>
            format.number(value, { style: "currency", currency: "VND", maximumFractionDigits: 0 }),
        workspaceId,
    }
    const dayText = (date: string) =>
        format.dateTime(new Date(`${date}T12:00:00Z`), {
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
            timeZone: "UTC",
        })
    const visible = board.bookings.filter(
        (booking) => (!isToday || booking.date === board.today) && (showCancelled || booking.status !== "cancelled"),
    )
    const open = board.bookings.find((booking) => booking.id === openId)
    const cancelling = board.bookings.find((booking) => booking.id === cancelId)
    const activeServices = board.services.filter((service) => service.active)
    const blank = placement(activeServices[0]?.id ?? "", board.today)
    const resourceOptions = board.resources
        .filter((resource) => resource.active)
        .map((resource) => ({ id: resource.id, label: resource.name }))
    const anchor = anchorValue === "" ? board.today : anchorValue
    const nav = {
        prevLabel: t("prev"),
        nextLabel: t("next"),
        thisWeekLabel: t("today"),
        dateLabel: t("pickDate"),
        date: anchor,
        showCancelledLabel: t("showCancelled"),
        showCancelled,
        rangeText: `${dayText(board.from)} - ${dayText(board.to)}${loadingSuffix}`,
    }
    return { words, dayText, visible, open, cancelling, activeServices, blank, resourceOptions, anchor, nav }
}

/** Builds the confirmation copy for the booking awaiting cancellation. */
export const buildBookingCancel = (
    cancelling: NonNullable<ReturnType<typeof useBookingRange>["board"]>["bookings"][number] | undefined,
    t: ReturnType<typeof useTranslations<"workbenchBooking">>,
):
    | {
          cancel?: never
      }
    | {
          cancel: {
              title: string
              confirmLabel: string
              keepLabel: string
          }
      } =>
    cancelling === undefined
        ? {}
        : {
              cancel: {
                  title: t("confirmCancelTitle", {
                      name: cancelling.customer === "" ? t("customerFallback") : cancelling.customer,
                  }),
                  confirmLabel: t("confirmCancelYes"),
                  keepLabel: t("confirmCancelKeep"),
              },
          }

/** Resolves the legend labels for each booking status tone. */
export const buildBookingLegend = (
    tones: Readonly<Record<string, BadgeTone>>,
    t: ReturnType<typeof useTranslations<"workbenchBooking">>,
): {
    text: string
    tone: BadgeTone
}[] =>
    Object.entries(tones).map(([status, tone]) => ({
        text: t(`status_${status}`),
        tone,
    }))
