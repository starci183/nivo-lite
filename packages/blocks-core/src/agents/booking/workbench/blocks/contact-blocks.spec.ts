import { contactBlockProblems } from "@nivo-lite/agent-sdk/module"
import { coreBlocks } from "../../../../shared/blocks/core-blocks"
import { bookingEntity } from "../../entities/booking.entity"
import { BOOKING_MESSAGES } from "../../booking-messages"
import { bookingModule } from "../../declaration"

/** Every `{ "key": ... }` text a value holds, at any depth. */
const keysIn = (value: unknown): ReadonlyArray<string> => {
    if (Array.isArray(value)) return value.flatMap(keysIn)
    if (typeof value !== "object" || value === null) return []
    return Object.entries(value).flatMap(([name, member]) =>
        name === "key" && typeof member === "string" ? [member] : keysIn(member),
    )
}

describe("the Booking block on the contact detail", () => {
    it("mounts the bookings of the person over the Booking's own read that takes a contactId", () => {
        expect(bookingModule.contactBlocks?.map((block) => block.id)).toEqual(["bookings"])
        expect(bookingModule.contactBlocks?.map((block) => block.read)).toEqual(["blocks-core.booking.api.booking.of-contact"])
        expect(bookingModule.reads.map((read) => read.id)).toContain("blocks-core.booking.api.booking.of-contact")
    })

    it("is sound: the read reaches a type with a contact field and the record list fits the read", () => {
        expect(contactBlockProblems(bookingModule, coreBlocks, [bookingEntity])).toEqual([])
    })

    it("words its block with module messages of both languages", () => {
        const keys = keysIn(bookingModule.contactBlocks)
        expect(keys.length).toBeGreaterThan(5)
        for (const locale of ["vi", "en"] as const) {
            const known = new Set(Object.keys(BOOKING_MESSAGES[locale]))
            expect(keys.filter((key) => !known.has(key))).toEqual([])
        }
    })
})

describe("the booking's contact field", () => {
    it("clears when the contact is deleted: the booking stays in the calendar", () => {
        const field = bookingEntity.fields.contactId
        expect(field.kind).toBe("contact")
        expect(field.nullable).toBe(true)
        expect(field.onContactDelete).toBe("clear")
    })

    it("has the index the contact read is served by: the contact, the latest visit first", () => {
        expect(bookingEntity.indexes?.find((index) => index.name === "contact_start")?.on).toEqual([
            "contactId",
            { desc: "startAt" },
            { desc: "id" },
        ])
    })
})
