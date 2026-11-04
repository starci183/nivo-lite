import { Test } from "@nestjs/testing"
import { insertedId } from "./inserted-id.policy"

const SUBJECT = Symbol("inserted-id.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { insertedId } }],
    }).compile()
    return moduleRef.get<{ insertedId: typeof insertedId }>(SUBJECT)
}

describe("insertedId", () => {
    it("reads the id of the first row, and answers an empty text for an insert that answered none or a key that is not an id", async () => {
        const subject = await build()

        expect(subject.insertedId([{ id: "row-1" }, { id: "row-2" }])).toBe("row-1")
        expect(subject.insertedId([])).toBe("")
        expect(subject.insertedId([{ id: 7 }])).toBe("")
    })
})
