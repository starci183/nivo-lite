import { Test } from "@nestjs/testing"
import { createdAtOfRows as createdAtOfRowsReal, cursorOfRows as cursorOfRowsReal } from "./message-cursor-rows.policy"

const SUBJECT = Symbol("message-cursor-rows.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: { createdAtOfRows: createdAtOfRowsReal, cursorOfRows: cursorOfRowsReal } },
        ],
    }).compile()
    return moduleRef.get<{ createdAtOfRows: typeof createdAtOfRowsReal; cursorOfRows: typeof cursorOfRowsReal }>(
        SUBJECT,
    )
}

describe("cursorOfRows", () => {
    it("reads the id and instant of the first row", async () => {
        const { cursorOfRows } = await build()

        expect(cursorOfRows([{ id: "m1", createdAt: "2026-10-25T01:00:00+00:00" }])).toEqual({
            id: "m1",
            createdAt: "2026-10-25T01:00:00+00:00",
        })
    })

    it("answers none for no row, a row that is not an object and a row missing text fields", async () => {
        const { cursorOfRows } = await build()

        expect(cursorOfRows([])).toBeNull()
        expect(cursorOfRows(["broken"])).toBeNull()
        expect(cursorOfRows([null])).toBeNull()
        expect(cursorOfRows([{ id: 7, createdAt: "x" }])).toBeNull()
        expect(cursorOfRows([{ id: "m1" }])).toBeNull()
    })
})

describe("createdAtOfRows", () => {
    it("answers the first instant that is text", async () => {
        const { createdAtOfRows } = await build()

        expect(createdAtOfRows(["broken", { createdAt: 7 }, { createdAt: "2026-10-25T01:00:00+00:00" }])).toBe(
            "2026-10-25T01:00:00+00:00",
        )
    })

    it("answers none when no row carries one", async () => {
        const { createdAtOfRows } = await build()

        expect(createdAtOfRows([])).toBeNull()
        expect(createdAtOfRows([null, { createdAt: 7 }])).toBeNull()
    })
})
