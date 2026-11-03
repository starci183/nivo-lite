import { insertedId } from "./inserted-id.policy"

describe("insertedId", () => {
    it("reads the id of the first row, and answers an empty text for an insert that answered none or a key that is not an id", () => {
        expect(insertedId([{ id: "row-1" }, { id: "row-2" }])).toBe("row-1")
        expect(insertedId([])).toBe("")
        expect(insertedId([{ id: 7 }])).toBe("")
    })
})
