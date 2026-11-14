import type { ModuleContactBlock } from "@nivo-lite/agent-sdk/module"

/**
 * The Booking's block on the contact detail: the person's bookings with this agent (the latest visits first, the first rows; the calendar
 * holds the rest), drawn by the generic record list over the Booking's own read. The host card already is the surface, so the list is plain.
 */
export const BOOKING_CONTACT_BLOCKS: ReadonlyArray<ModuleContactBlock> = [
    {
        id: "bookings",
        title: { vi: "L\u1ecbch h\u1eb9n", en: "Bookings" },
        read: "blocks-core.booking.api.booking.of-contact",
        block: {
            id: "core.record-list",
            slot: "rows",
            props: {
                label: { key: "contact_bookings_label" },
                empty: { key: "contact_bookings_empty" },
                idPath: "id",
                titlePath: "customerName",
                descriptionPath: "note",
                badgePath: "status",
                metaPath: "startAt",
                badgeTones: { requested: "warning", confirmed: "neutral", cancelled: "neutral", done: "neutral" },
                labels: {
                    status: {
                        requested: { key: "status_requested" },
                        confirmed: { key: "status_confirmed" },
                        cancelled: { key: "status_cancelled" },
                        done: { key: "status_done" },
                    },
                },
                surface: "plain",
            },
        },
    },
]
