import type { Dispatch, SetStateAction } from "react"
import type { useTranslations } from "next-intl"
import {
    placementLabelsOf,
    type useBookingRange,
    type useBookingPlacement,
    type useBookingActions,
    type PlacementFields,
} from "@/hooks/bookingDesk"
import { shiftDate } from "@/modules/i18n"

/** Inputs for the open placement dialog; services and resources are already active. */
interface PlacementViewInput {
    readonly place: ReturnType<typeof useBookingPlacement>
    readonly activeServices: NonNullable<ReturnType<typeof useBookingRange>["board"]>["services"]
    readonly resourceOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly t: ReturnType<typeof useTranslations<"workbenchBooking">>
}

/** Resolves dialog copy and resource choices for the current add or move session. */
export const bookingPlacementView = (
    connected: PlacementViewInput,
    autoResource: string,
):
    | {
          placement?: never
      }
    | {
          placement: {
              canForce: boolean
              isPending: boolean
              refusal?: string
              mode: "add" | "move"
              title: string
              fields: PlacementFields
              serviceOptions: {
                  id: string
                  label: string
              }[]
              resourceOptions: readonly {
                  readonly id: string
                  readonly label: string
              }[]
              labels: {
                  name: string
                  phone: string
                  service: string
                  date: string
                  time: string
                  resource: string
                  party: string
                  note: string
                  notePlaceholder: string
                  force: string
                  save: string
                  cancel: string
                  close: string
              }
          }
      } => {
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

/** What `buildBookingDeskEvents` returns. */
export interface BuildBookingDeskEventsResult {
    add: () => unknown
    placementChange: (patch: Partial<PlacementFields>) => void
    placementSubmit: () => void
    placementClose: () => void
    prev: () => void
    next: () => void
    thisWeek: () => void
    pickDate: (date: string) => void
    toggleCancelled: (value: boolean) => void
    dismissNotice: () => void
    open: (id: string) => void
    act: (id: string, action: string) => void
    confirmCancel: () => void
    keepBooking: () => void
    detailAction: (action: string) => void
    closeDetail: () => void
}

/** Maps the agenda controls and dialogs to the injected commands. */
export const buildBookingDeskEvents = (
    connected: BookingDeskEventsInput,
    moveAction: string,
): BuildBookingDeskEventsResult => {
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
        toggleCancelled: (value: boolean) => setShowCancelled(value),
        dismissNotice: desk.dismiss,
        open: (id: string) => setOpenId(id),
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
