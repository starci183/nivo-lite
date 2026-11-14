import { specDocumentSchema, type SpecDocument } from "@nivo-lite/agent-sdk/spec"
import { viewNodeOf, withAgentDesk, type DeskOfModule } from "../../platform/specs/agent-desk"
import data from "./booking.workbench.json"

/** The desk of the Booking agent: block 6 lists the bookings, the services and the people and rooms, each opening the module's own table as a page. */
export const BOOKING_DESK: DeskOfModule = {
    dataSets: [
        { set: "bookings", label: { vi: "L\u1ecbch h\u1eb9n", en: "Bookings" } },
        { set: "services", label: { vi: "D\u1ecbch v\u1ee5", en: "Services" } },
        { set: "resources", label: { vi: "Ng\u01b0\u1eddi v\u00e0 ph\u00f2ng", en: "People and rooms" } },
    ],
    pages: {
        bookings: viewNodeOf(data, "bookings-table"),
        services: viewNodeOf(data, "services-table"),
        resources: viewNodeOf(data, "resources-table"),
    },
}

/** The seed spec of the Booking workbench: the agent's desk first, then the bookings, the services, the people and rooms and the rules, parsed once. */
export const BOOKING_WORKBENCH_SPEC: SpecDocument = specDocumentSchema.parse(withAgentDesk(data, BOOKING_DESK))
