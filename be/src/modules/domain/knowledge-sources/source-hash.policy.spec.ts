import { Test } from "@nestjs/testing"
import { contentHashOf } from "./source-hash.policy"

const SUBJECT = Symbol("source-hash.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { contentHashOf } }],
    }).compile()
    return moduleRef.get<{ contentHashOf: typeof contentHashOf }>(SUBJECT)
}

describe("contentHashOf", () => {
    it("answers the hex SHA-256 of the text as UTF-8", async () => {
        const subject = await build()

        expect(subject.contentHashOf("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
        expect(subject.contentHashOf("\u0110i\u1ec1u 1")).toBe(
            "f53f19722941183c87c29342669c58f7c9557bd525c1d2c2819936a3d1e8d7dd",
        )
    })

    it("tells two texts apart and answers the same value for the same text", async () => {
        const subject = await build()

        expect(subject.contentHashOf("a")).toBe(subject.contentHashOf("a"))
        expect(subject.contentHashOf("a")).not.toBe(subject.contentHashOf("b"))
    })
})
