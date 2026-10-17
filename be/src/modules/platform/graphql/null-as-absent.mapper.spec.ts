import { Test } from "@nestjs/testing"
import { plainToInstance } from "class-transformer"
import { NullAsAbsent } from "./null-as-absent.mapper"

const SUBJECT = Symbol("null-as-absent.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { NullAsAbsent } }],
    }).compile()
    const subject = moduleRef.get<{ NullAsAbsent: typeof NullAsAbsent }>(SUBJECT)
    class OptionalNote {
        @subject.NullAsAbsent()
        note?: string | null
    }
    return OptionalNote
}

describe("NullAsAbsent", () => {
    it("reads an explicit null as absent", async () => {
        const OptionalNote = await build()
        expect(plainToInstance(OptionalNote, { note: null }).note).toBeUndefined()
    })
    it("keeps a given value", async () => {
        const OptionalNote = await build()
        expect(plainToInstance(OptionalNote, { note: "hello" }).note).toBe("hello")
    })
    it("leaves an absent field absent", async () => {
        const OptionalNote = await build()
        expect(plainToInstance(OptionalNote, {}).note).toBeUndefined()
    })
})
