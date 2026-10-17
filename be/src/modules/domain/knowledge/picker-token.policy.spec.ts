import { Test } from "@nestjs/testing"
import { isPickerToken } from "./picker-token.policy"

const SUBJECT = Symbol("picker-token.policy")
type Subject = { isPickerToken: typeof isPickerToken }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isPickerToken } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("isPickerToken", () => {
    it("accepts a token made of the characters Google tokens use", async () => {
        const subject = await build()

        expect(subject.isPickerToken("ya29.a0AfH6SMB-xyz_123~+/=abcdef")).toBe(true)
    })

    it("refuses a token that is too short, too long or made of other characters", async () => {
        const subject = await build()

        expect(subject.isPickerToken("short")).toBe(false)
        expect(subject.isPickerToken("a".repeat(4097))).toBe(false)
        expect(subject.isPickerToken(`${"a".repeat(30)} <script>`)).toBe(false)
    })
})
