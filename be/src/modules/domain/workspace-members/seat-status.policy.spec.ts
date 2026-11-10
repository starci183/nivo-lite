import { Test } from "@nestjs/testing"
import { SEAT_NOTE_MAX, seatStatusWrite as realSeatStatusWrite } from "./seat-status.policy"

const SUBJECT = Symbol("seat-status.policy")
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { seatStatusWrite: realSeatStatusWrite } }],
    }).compile()
    return moduleRef.get<typeof import("./seat-status.policy")>(SUBJECT)
}

describe("seatStatusWrite", () => {
    it("records who switched a seat off, on the database clock, with the trimmed note", async () => {
        const write = (await buildSubject()).seatStatusWrite("disabled", "owner-1", "  left the shop  ")

        expect(write).toMatchObject({
            status: "disabled",
            disabledBy: "owner-1",
            disabledNote: "left the shop",
            disabledByDeletion: false,
        })
        expect(typeof write.disabledAt === "function" ? write.disabledAt() : write.disabledAt).toBe("now()")
    })

    it.each([undefined, null, "   "])("stores no note for %p", async (note) => {
        expect((await buildSubject()).seatStatusWrite("disabled", "owner-1", note).disabledNote).toBeNull()
    })

    it("bounds a long note", async () => {
        expect(
            (await buildSubject()).seatStatusWrite("disabled", "owner-1", "x".repeat(600)).disabledNote,
        ).toHaveLength(SEAT_NOTE_MAX)
    })

    it("clears every trace when the seat is switched on again", async () => {
        expect((await buildSubject()).seatStatusWrite("active", "owner-1", "ignored")).toEqual({
            status: "active",
            disabledAt: null,
            disabledBy: null,
            disabledNote: null,
            disabledByDeletion: false,
        })
    })
})
