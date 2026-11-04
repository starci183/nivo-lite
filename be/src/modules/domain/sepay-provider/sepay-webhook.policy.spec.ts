import { Test } from "@nestjs/testing"
import { isSepayPing, isValidApiKey, presentedApiKey, readSepayPayload } from "./sepay-webhook.policy"

const SUBJECT = Symbol("sepay-webhook.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isSepayPing, isValidApiKey, presentedApiKey, readSepayPayload } }],
    }).compile()
    return moduleRef.get<{
        isSepayPing: typeof isSepayPing
        isValidApiKey: typeof isValidApiKey
        presentedApiKey: typeof presentedApiKey
        readSepayPayload: typeof readSepayPayload
    }>(SUBJECT)
}

describe("sepay webhook policy > presentedApiKey", () => {
    it("reads the key of an Apikey header and nothing else", async () => {
        const subject = await build()

        expect(subject.presentedApiKey("Apikey  abc ")).toBe("abc")
        expect(subject.presentedApiKey("Bearer abc")).toBeUndefined()
        expect(subject.presentedApiKey(undefined)).toBeUndefined()
    })
})

describe("sepay webhook policy > isValidApiKey", () => {
    it("accepts exactly the configured key", async () => {
        const subject = await build()

        expect(subject.isValidApiKey("Apikey s3cret", "s3cret")).toBe(true)
        expect(subject.isValidApiKey("  apikey   s3cret  ", "s3cret")).toBe(true)
    })

    it("refuses another key, a key of another length, another scheme and a missing header", async () => {
        const subject = await build()

        expect(subject.isValidApiKey("Apikey s3creT", "s3cret")).toBe(false)
        expect(subject.isValidApiKey("Apikey s3cret2", "s3cret")).toBe(false)
        expect(subject.isValidApiKey("Bearer s3cret", "s3cret")).toBe(false)
        expect(subject.isValidApiKey(undefined, "s3cret")).toBe(false)
    })

    it("refuses every delivery when no key is configured", async () => {
        const subject = await build()

        expect(subject.isValidApiKey("Apikey ", undefined)).toBe(false)
        expect(subject.isValidApiKey("Apikey anything", "")).toBe(false)
    })
})

describe("sepay webhook authorization whitespace", () => {
    it("handles long whitespace, empty keys and line breaks without accepting another scheme", async () => {
        const subject = await build()

        expect(subject.presentedApiKey(` Apikey ${" ".repeat(20000)}token  `)).toBe("token")
        expect(subject.presentedApiKey("Apikey ")).toBeUndefined()
        expect(subject.presentedApiKey("Apikey  ")).toBe(" ")
        expect(subject.presentedApiKey("Apikey  \n")).toBe(" ")
        expect(subject.presentedApiKey("Apikey a\nb")).toBeUndefined()
    })
})

describe("sepay webhook policy > isSepayPing", () => {
    it.each([
        [{}],
        [{ transferType: "in", transferAmount: 0 }],
        [{ id: "x", transferType: "refund", transferAmount: 5 }],
    ])("reads %j as a ping", async (body) => {
        const subject = await build()

        expect(subject.isSepayPing(body)).toBe(true)
    })

    it.each([
        [{ id: 7 }],
        [{ id: "7", transferType: "in", transferAmount: 10 }],
        [{ transferType: "in", transferAmount: "990000" }],
    ])("reads %j as a delivery", async (body) => {
        const subject = await build()

        expect(subject.isSepayPing(body)).toBe(false)
    })
})

describe("sepay webhook policy > readSepayPayload", () => {
    it("reads the fields the settlement uses", async () => {
        const subject = await build()

        const body = {
            id: 42,
            transferType: "in",
            transferAmount: "990000",
            content: "NIVO8F3K2",
            code: null,
            description: "BankAPINotify",
            gateway: "MB",
        }
        expect(subject.readSepayPayload(body)).toEqual({
            id: 42,
            gateway: "MB",
            transferType: "in",
            transferAmount: 990000,
            content: "NIVO8F3K2",
            code: null,
            description: "BankAPINotify",
        })
    })

    it("leaves missing or mistyped fields empty and counts a missing amount as 0", async () => {
        const subject = await build()

        expect(subject.readSepayPayload({ id: "7", transferType: 1, content: 5 })).toEqual({
            id: 7,
            gateway: undefined,
            transferType: undefined,
            transferAmount: 0,
            content: null,
            code: null,
            description: null,
        })
    })

    it("keeps an unreadable amount undefined so nothing is settled with it", async () => {
        const subject = await build()

        expect(subject.readSepayPayload({ id: 1, transferAmount: "x" })).toMatchObject({ transferAmount: undefined })
        expect(subject.readSepayPayload({ id: 1, transferAmount: null })).toMatchObject({ transferAmount: 0 })
    })

    it.each([[undefined], [null], ["abc"], [1.5], [Number.MAX_SAFE_INTEGER + 2]])(
        "reads no payload for the id %p",
        async (id) => {
            const subject = await build()

            expect(subject.readSepayPayload({ id })).toBeUndefined()
        },
    )
})
