import { createHash } from "node:crypto"
import { Test } from "@nestjs/testing"
import { normalizeText } from "./chunk.policy"
import { passageHashOf, passageTextHashOf } from "./passage-hash.policy"

const SUBJECT = Symbol("passage-hash.policy")
type Subject = { passageHashOf: typeof passageHashOf; passageTextHashOf: typeof passageTextHashOf }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { passageHashOf, passageTextHashOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("passageHashOf", () => {
    it("is the hash the migration computes from stored text: the text, a newline, the model", async () => {
        const subject = await build()
        const text = normalizeText("One  line\r\nand another")

        expect(subject.passageHashOf(text, "m1")).toBe(createHash("sha256").update(`${text}\nm1`, "utf8").digest("hex"))
    })

    it("ignores what normalising removes", async () => {
        const subject = await build()

        expect(subject.passageHashOf("One  line", "m1")).toBe(subject.passageHashOf("One line", "m1"))
    })

    it("differs for another text and for another model", async () => {
        const subject = await build()

        expect(subject.passageHashOf("a", "m1")).not.toBe(subject.passageHashOf("b", "m1"))
        expect(subject.passageHashOf("a", "m1")).not.toBe(subject.passageHashOf("a", "m2"))
    })
})

describe("passageTextHashOf", () => {
    it("depends on the normalised text alone", async () => {
        const subject = await build()

        expect(subject.passageTextHashOf("One  line")).toBe(subject.passageTextHashOf("One line"))
        expect(subject.passageTextHashOf("a")).not.toBe(subject.passageTextHashOf("b"))
    })
})
