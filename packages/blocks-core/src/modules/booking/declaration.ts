import { defineModule, type ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { SAVE_HOURS, SAVE_SETTINGS, SET_STATUS } from "./actions/calendar.actions"
import { SAVE_RESOURCE, SAVE_SERVICE } from "./actions/catalogue.actions"
import { BOOKING_PERMISSIONS } from "./constants"
import { BOOKING_CONTACT_BLOCKS } from "./contact-blocks"
import { CONTACT_BOOKINGS } from "./reads/contact-bookings.read"
import { BOOKINGS_READ, RESOURCES_READ, SERVICES_READ } from "./reads/lists.read"
import { SETTINGS_READ } from "./reads/settings.read"
import { BOOKING_WORKBENCH_SPEC } from "./specs/booking.workbench"

/** The module key of Booking: every read and action id starts with it. */
export const BOOKING_MODULE_KEY = "booking"

/**
 * The Booking module: the bookings, the services, the people and rooms that serve them and the rules of the calendar as reads over the
 * declared record types, and the actions that change them. The seed spec draws the agent's desk first, then its own views from the generic
 * blocks; the agent books and reminds through its graphs (`template/booking.agent.ts`), under the guidance declared here.
 */
export const bookingModule: ModuleDeclaration = defineModule({
    key: BOOKING_MODULE_KEY,
    namespace: BOOKING_MODULE_KEY,
    agent: {
        tools: [TOOL.customerMessageSend, TOOL.teamMessagePost],
    },
    permissions: BOOKING_PERMISSIONS,
    reads: [BOOKINGS_READ, CONTACT_BOOKINGS, SERVICES_READ, RESOURCES_READ, SETTINGS_READ],
    actions: [SAVE_SERVICE, SAVE_RESOURCE, SET_STATUS, SAVE_HOURS, SAVE_SETTINGS],
    contactBlocks: BOOKING_CONTACT_BLOCKS,
    specs: [BOOKING_WORKBENCH_SPEC],
})
