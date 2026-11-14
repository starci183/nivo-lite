import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import { type TemplateAgent, defineTemplateAgent } from "@nivo-lite/agent-sdk/template"
import { bilingualOf } from "../../../messages/catalog"
import { BOOK_GRAPH_KEY, bookingBookGraph } from "./book.graph"
import { bookingRemindGraph } from "./remind.graph"

/**
 * The Booking agent template: the customer channels it books and reminds through (Zalo OA, Telegram, Facebook, in the order they are
 * attached); its graphs are the booking (primary, called by the front desk) and the hourly reminders. Its module declares the agent's
 * tools and guidance; like content, it has no team-chat graph (the router only reaches a module that ships `<module>.team-chat`).
 */
export const bookingAgent: TemplateAgent = defineTemplateAgent({
    key: "booking",
    label: bilingualOf("contractAgentBooking"),
    accounts: [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta],
    graphs: [bookingBookGraph, bookingRemindGraph],
    primary: BOOK_GRAPH_KEY,
})
