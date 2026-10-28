import type { BadgeTone } from "@starci/grammar/common"
import type { Dispatch, SetStateAction } from "react"
import type { useTranslations, useFormatter } from "next-intl"
import {
    placementLabelsOf,
    type useBookingRange,
    type useBookingPlacement,
    type useBookingActions,
    type blankPlacementOf,
} from "@/hooks/bookingDesk"
import { shiftDate } from "@/modules/i18n"

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

/** State and injected commands needed by the booking desk interactions. */
interface BookingDeskEventsInput {
    readonly openAdd: () => unknown
    readonly place: ReturnType<typeof useBookingPlacement>
    readonly range: ReturnType<typeof useBookingRange>
    readonly anchor: string
    readonly board: NonNullable<ReturnType<typeof useBookingRange>["board"]>
    readonly setShowCancelled: Dispatch<SetStateAction<boolean>>
    readonly desk: ReturnType<typeof useBookingActions>
    readonly setOpenId: Dispatch<SetStateAction<string | null>>
    readonly act: (id: string, action: string) => void
    readonly cancelId: string | null
    readonly setCancelId: Dispatch<SetStateAction<string | null>>
    readonly open: NonNullable<ReturnType<typeof useBookingRange>["board"]>["bookings"][number] | undefined
    readonly openMove: (id: string) => void
}

/** Maps the agenda controls and dialogs to the injected commands. */
export const buildBookingDeskEvents = (connected: BookingDeskEventsInput, moveAction: string) => {
    const {
        openAdd,
        place,
        range,
        anchor,
        board,
        setShowCancelled,
        desk,
        setOpenId,
        act,
        cancelId,
        setCancelId,
        open,
        openMove,
    } = connected
    return {
        add: openAdd,
        placementChange: place.change,
        placementSubmit: place.submit,
        placementClose: place.close,
        prev: () => range.goto(shiftDate(anchor, -7)),
        next: () => range.goto(shiftDate(anchor, 7)),
        thisWeek: () => range.goto(board.today),
        pickDate: range.goto,
        toggleCancelled: setShowCancelled,
        dismissNotice: desk.dismiss,
        open: setOpenId,
        act,
        confirmCancel: () => {
            if (cancelId === null) return
            desk.act(cancelId, "cancel", () => {
                setCancelId(null)
                setOpenId(null)
            })
        },
        keepBooking: () => setCancelId(null),
        detailAction: (action: string) => {
            if (open === undefined) return
            if (action === moveAction) openMove(open.id)
            else act(open.id, action)
        },
        closeDetail: () => setOpenId(null),
    }
}
