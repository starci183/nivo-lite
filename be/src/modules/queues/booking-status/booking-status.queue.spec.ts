import { BOOKING_STATUS_QUEUE, bookingStatusPayloadOf } from "./booking-status.queue"

describe("booking status payload", () => {
    it("uses the queue named by the booking trigger", () => {
        expect(BOOKING_STATUS_QUEUE).toBe("booking_status")
    })

    it.each(["created", "status", "moved"])("reads a %s booking change and drops extra fields", (kind) => {
        expect(bookingStatusPayloadOf({ workspaceId: "ws-1", bookingId: "booking-1", kind, extra: "ignored" })).toEqual(
            {
                workspaceId: "ws-1",
                bookingId: "booking-1",
                kind,
            },
        )
    })

    it.each([
        [{}, { workspaceId: "", bookingId: "", kind: "status" }],
        [
            { workspaceId: 1, bookingId: "booking-1", kind: "created" },
            { workspaceId: "", bookingId: "booking-1", kind: "created" },
        ],
        [
            { bookingId: "booking-1", kind: "moved" },
            { workspaceId: "", bookingId: "booking-1", kind: "moved" },
        ],
        [
            { workspaceId: "ws-1", kind: "created" },
            { workspaceId: "ws-1", bookingId: "", kind: "created" },
        ],
        [
            { workspaceId: "ws-1", bookingId: 1, kind: "created" },
            { workspaceId: "ws-1", bookingId: "", kind: "created" },
        ],
        [
            { workspaceId: "ws-1", bookingId: "booking-1" },
            { workspaceId: "ws-1", bookingId: "booking-1", kind: "status" },
        ],
        [
            { workspaceId: "ws-1", bookingId: "booking-1", kind: 1 },
            { workspaceId: "ws-1", bookingId: "booking-1", kind: "status" },
        ],
        [
            { workspaceId: "ws-1", bookingId: "booking-1", kind: "other" },
            { workspaceId: "ws-1", bookingId: "booking-1", kind: "status" },
        ],
        [
            { workspaceId: "", bookingId: "", kind: "moved" },
            { workspaceId: "", bookingId: "", kind: "moved" },
        ],
    ])("normalizes unreadable fields in %p", (value, expected) => {
        expect(bookingStatusPayloadOf(value)).toEqual(expected)
    })
})
