import { DRAFT_SCHEMA } from "./draft.schema"

describe("DRAFT_SCHEMA", () => {
    it("takes a text for customers", () => {
        expect(DRAFT_SCHEMA.safeParse({ body: "Same day delivery." }).success).toBe(true)
    })

    it.each([{}, { body: "" }, { body: 3 }, { body: "x".repeat(40_001) }])("refuses %j", (answer) => {
        expect(DRAFT_SCHEMA.safeParse(answer).success).toBe(false)
    })
})
