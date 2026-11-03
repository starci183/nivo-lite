export { AUTO_RESOURCE, MOVE_ACTION, actionsOf } from "@/modules/booking-desk"
export {
    BOOKING_STATUS_TONE,
    blankPlacementOf,
    dayGroups,
    detailOf,
    placementLabelsOf,
    bookingRowOf,
} from "./bookingDesk.shared"
export { useBookingActions } from "./useBookingActions"
export { useBookingRange } from "./useBookingRange"
export { useBookingPlacement } from "./useBookingPlacement"
export { useBookingTransition } from "./useBookingTransition"
export type { PlacementFields } from "./useBookingPlacement"
export type { PlacementDraft } from "./useBookingPlacement"
export type { DeskNotice } from "./bookingDesk.shared"
