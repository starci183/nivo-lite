import type { PlacementFields } from "./useBookingPlacement"

/** What the desk tells the owner after a command: a catalog code. */
export interface DeskNotice {
    readonly tone: "affirmative" | "negative"
    readonly code: string
}

/** The fields of a new booking: the first service, today at nine, any resource, one guest. */
export const blankPlacementOf = (serviceId: string, today: string): PlacementFields => ({
    serviceId,
    date: today,
    time: "09:00",
    resourceId: "",
    name: "",
    phone: "",
    party: 1,
    note: "",
    force: false,
})
