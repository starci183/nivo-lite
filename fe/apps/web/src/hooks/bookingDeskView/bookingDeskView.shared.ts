import type { BadgeTone } from "@starci/grammar/common"
import type { useTranslations, useFormatter } from "next-intl"
import {
    placementLabelsOf,
    type useBookingRange,
    type useBookingPlacement,
    type blankPlacementOf,
} from "@/hooks/bookingDesk"

/** Inputs owned by this display/state mapping. */
interface BookingDeskDisplayInput {
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

/** Derives the visible booking agenda and localized navigation. */
export const buildBookingDeskDisplay = ({
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
}: BookingDeskDisplayInput) => {
    const words = {
        say: t,
        resourceName: (id: string) => board.resources.find((resource) => resource.id === id)?.name ?? "",
        money: (value: number) =>
            format.number(value, { style: "currency", currency: "VND", maximumFractionDigits: 0 }),
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
) =>
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
) =>
    Object.entries(tones).map(([status, tone]) => ({
        text: t(`status_${status}`),
        tone,
    }))

/** Inputs for the open placement dialog; services and resources are already active. */
interface PlacementViewInput {
    readonly place: ReturnType<typeof useBookingPlacement>
    readonly activeServices: NonNullable<ReturnType<typeof useBookingRange>["board"]>["services"]
    readonly resourceOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly t: ReturnType<typeof useTranslations<"workbenchBooking">>
}

/** Resolves dialog copy and resource choices for the current add or move session. */
export const bookingPlacementView = (connected: PlacementViewInput, autoResource: string) => {
    const { place, t } = connected
    if (place.draft === null || place.fields === null) return {}
    return {
        placement: {
            mode: place.draft.kind,
            title: t(place.draft.kind === "add" ? "addBooking" : "moveTitle"),
            fields: place.fields,
            serviceOptions: connected.activeServices.map((service) => ({ id: service.id, label: service.name })),
            resourceOptions:
                place.draft.kind === "add"
                    ? [{ id: autoResource, label: t("autoResource") }, ...connected.resourceOptions]
                    : connected.resourceOptions,
            labels: placementLabelsOf(t, place.draft.kind),
            ...(place.reason === null ? {} : { refusal: t(`reason_${place.reason}`) }),
            canForce: place.canForce,
            isPending: place.isBusy,
        },
    }
}
