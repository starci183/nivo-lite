import en from "@/modules/i18n/messages/en/workbenchBooking.json"
import vi from "@/modules/i18n/messages/vi/workbenchBooking.json"
import { defineDict } from "../core"

/** Copy of the Booking agent dashboard (/agents/booking/workbench): the four figures of the ribbon, the failure state and the tab labels the loading view repeats. */
export const workbenchBooking = defineDict("workbenchBooking", { en, vi })
