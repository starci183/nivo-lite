import { Test } from "@nestjs/testing"
import { fileReadBlockOf, fileReadOf, isPictureFile, moneyViaOf, UNREADABLE_FILE } from "./file-read.policy"

const SUBJECT = Symbol("file-read.policy")

/** The policy, built the way Nest builds a provider. */
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { fileReadBlockOf, fileReadOf, isPictureFile, moneyViaOf } }],
    }).compile()
    return moduleRef.get<typeof import("./file-read.policy")>(SUBJECT)
}

const ANSWER = {
    is_transfer: true,
    amount_vnd: 3_500_000,
    recipient: "SHOP A",
    paid_at: "2026-11-01 10:00",
    clear: true,
}

describe("fileReadOf", () => {
    it("reads a clear transfer into the record", async () => {
        expect((await build()).fileReadOf(ANSWER)).toEqual({
            isTransfer: true,
            amountVnd: 3_500_000,
            recipient: "SHOP A",
            paidAt: "2026-11-01 10:00",
        })
    })

    it("leaves the amount missing when the model is not sure of it", async () => {
        expect((await build()).fileReadOf({ ...ANSWER, clear: false }).amountVnd).toBeNull()
    })

    it.each([
        ["no answer", null],
        ["an answer outside the shape", { amount: "3tr5" }],
        ["a negative amount", { ...ANSWER, amount_vnd: -1 }],
        ["a fractional amount", { ...ANSWER, amount_vnd: 10.5 }],
    ])("reads %s as unreadable", async (_case, parsed) => {
        expect((await build()).fileReadOf(parsed)).toEqual(UNREADABLE_FILE)
    })
})

describe("fileReadBlockOf", () => {
    it("states what was read and that it comes from the sender", async () => {
        const subject = await build()
        const block = subject.fileReadBlockOf(subject.fileReadOf(ANSWER))
        expect(block).toContain("3500000 VND")
        expect(block).toContain("this comes from the sender")
    })

    it("says an amount could not be read", async () => {
        expect((await build()).fileReadBlockOf(UNREADABLE_FILE)).toContain("amount: not readable")
    })

    it("says a file shows no transfer", async () => {
        const subject = await build()
        expect(subject.fileReadBlockOf(subject.fileReadOf({ ...ANSWER, is_transfer: false }))).toContain(
            "no money transfer",
        )
    })
})

describe("the kind of a file", () => {
    it("names a picture and a document by their money source", async () => {
        expect((await build()).moneyViaOf("image/png")).toBe("chat_image")
        expect((await build()).moneyViaOf("application/pdf")).toBe("chat_file")
    })

    it("sends a picture to the model and a document as text", async () => {
        expect((await build()).isPictureFile("image/webp")).toBe(true)
        expect((await build()).isPictureFile("application/pdf")).toBe(false)
    })
})
