import allEn from "@/modules/i18n/messages/en.json"
import allVi from "@/modules/i18n/messages/vi.json"
import { defineDict } from "../core"

/** Copy of the Booking agent dashboard (/agents/booking/workbench): the four figures of the ribbon, the failure state and the tab labels the loading view repeats. */
export const workbenchBooking = defineDict("workbenchBooking", {
    en: allEn["workbenchBooking"],
    vi: allVi["workbenchBooking"],
})
