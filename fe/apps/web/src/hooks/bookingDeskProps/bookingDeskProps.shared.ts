import type { BadgeTone } from "@starci/grammar/common"
import type { BookingAction, BookingDetailFact } from "@/modules/types"
import type { PlacementFields, bookingRowOf } from "@/hooks/bookingDesk"

/** One action offered by the detail dialog of a booking. */
type DetailAction =
    | { id: BookingAction; label: string; intent: "neutral" | "destructive" }
    | { id: string; label: string; intent: "neutral" }

/** The facts of the detail dialog that do not depend on whether a next step is offered. */
interface DeskDetailBase {
    isPending: boolean
    actions: DetailAction[]
    customerLabel: string
    customerHref?: string
    title: string
    description: string
    closeLabel: string
    statusLabel: string
    statusTone: BadgeTone
    items: readonly BookingDetailFact[]
}

/** The detail dialog of a booking, with or without the one next step its status allows. */
type DeskDetail =
    (DeskDetailBase & { next?: never }) | (DeskDetailBase & { next: { id: BookingAction; label: string } })

/** The confirmation that cancels a booking. */
interface DeskCancel {
    title: string
    confirmLabel: string
    keepLabel: string
}

/** The field labels of the add and move dialog. */
interface DeskPlacementLabels {
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

/** The add and move dialog. */
interface DeskPlacement {
    canForce: boolean
    isPending: boolean
    refusal?: string
    mode: "add" | "move"
    title: string
    fields: PlacementFields
    serviceOptions: { id: string; label: string }[]
    resourceOptions: readonly { readonly id: string; readonly label: string }[]
    labels: DeskPlacementLabels
}

/** The parts of the desk every state of it draws. */
interface DeskPropsBase {
    readonly detail?: DeskDetail
    readonly days: { id: string; label: string; rows: ReturnType<typeof bookingRowOf>[] }[]
    readonly empty: { readonly title: string; readonly body: string }
    readonly isPending: boolean
    readonly notice?: { tone: "affirmative" | "negative"; text: string; dismissLabel: string }
    readonly nav?: {
        prevLabel: string
        nextLabel: string
        thisWeekLabel: string
        dateLabel: string
        date: string
        showCancelledLabel: string
        showCancelled: boolean
        rangeText: string
    }
    readonly label: string
    readonly legend: { text: string; tone: BadgeTone }[]
    readonly add: { readonly label: string; readonly isDisabled: boolean }
}

/** What `bookingDeskProps` returns: the desk, with the cancel confirmation and the placement dialog open or not. */
export type BookingDeskPropsResult =
    | (DeskPropsBase & { readonly cancel?: never; readonly placement?: never })
    | (DeskPropsBase & { readonly cancel: DeskCancel; readonly placement?: never })
    | (DeskPropsBase & { readonly cancel?: never; readonly placement: DeskPlacement })
    | (DeskPropsBase & { readonly cancel: DeskCancel; readonly placement: DeskPlacement })
