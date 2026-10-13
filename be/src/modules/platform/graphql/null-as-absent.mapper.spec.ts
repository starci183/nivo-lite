import { plainToInstance } from "class-transformer"
import { NullAsAbsent } from "./null-as-absent.mapper"

class OptionalNote {
    @NullAsAbsent()
    note?: string | null
}

describe("NullAsAbsent", () => {
    it("reads an explicit null as absent", () => {
        expect(plainToInstance(OptionalNote, { note: null }).note).toBeUndefined()
    })

    it("keeps a given value", () => {
        expect(plainToInstance(OptionalNote, { note: "hello" }).note).toBe("hello")
    })

    it("leaves an absent field absent", () => {
        expect(plainToInstance(OptionalNote, {}).note).toBeUndefined()
    })
})
