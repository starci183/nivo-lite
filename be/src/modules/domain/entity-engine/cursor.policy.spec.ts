import { createHmac } from "node:crypto"
import { Test } from "@nestjs/testing"
import { CURSOR_TEXT_MAX, readCursor, signCursor } from "./cursor.policy"

const CURSOR: unique symbol = Symbol("entity-engine.cursor")

interface CursorPolicy {
    readonly readCursor: typeof readCursor
    readonly signCursor: typeof signCursor
}

const build = async (): Promise<CursorPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: CURSOR, useFactory: (): CursorPolicy => ({ readCursor, signCursor }) }],
    }).compile()
    return moduleRef.get<CursorPolicy>(CURSOR)
}

const KEY = Buffer.alloc(32, 3)
const OTHER_KEY = Buffer.alloc(32, 4)
const SCOPE = "scope-a"

const signedText = (body: string): string => {
    const encoded = Buffer.from(body).toString("base64url")
    return `${encoded}.${createHmac("sha256", KEY).update(encoded).digest().toString("base64url")}`
}

describe("signCursor and readCursor", () => {
    it("round-trips the position of a row for the scope it was minted for", async () => {
        const policy = await build()

        const cursor = policy.signCursor(KEY, SCOPE, ["2026-11-05T10:00:00+00:00", null, "id-1"])

        expect(policy.readCursor(KEY, SCOPE, cursor)).toEqual(["2026-11-05T10:00:00+00:00", null, "id-1"])
    })

    it("refuses a cursor minted for another list", async () => {
        const policy = await build()

        expect(policy.readCursor(KEY, "scope-b", policy.signCursor(KEY, SCOPE, ["a"]))).toBeNull()
    })

    it("refuses a cursor signed with another key", async () => {
        const policy = await build()

        expect(policy.readCursor(OTHER_KEY, SCOPE, policy.signCursor(KEY, SCOPE, ["a"]))).toBeNull()
    })

    it("refuses a cursor whose body was changed after signing", async () => {
        const policy = await build()
        const [, signature] = policy.signCursor(KEY, SCOPE, ["a"]).split(".")
        const forged = Buffer.from(JSON.stringify({ v: 1, s: SCOPE, p: ["b"] })).toString("base64url")

        expect(policy.readCursor(KEY, SCOPE, `${forged}.${signature ?? ""}`)).toBeNull()
    })

    it("refuses a cursor that is too long", async () => {
        const policy = await build()

        expect(policy.readCursor(KEY, SCOPE, "a".repeat(CURSOR_TEXT_MAX + 1))).toBeNull()
    })

    it.each(["", "onlybody", "a.b.c", ".sig", "body."])("refuses the malformed cursor %p", async (text) => {
        const policy = await build()

        expect(policy.readCursor(KEY, SCOPE, text)).toBeNull()
    })

    it("refuses a signed body that is not JSON", async () => {
        const policy = await build()

        expect(policy.readCursor(KEY, SCOPE, signedText("not json"))).toBeNull()
    })

    it.each([
        ["a number", "5"],
        ["a wrong version", JSON.stringify({ v: 2, s: SCOPE, p: ["a"] })],
        ["a position that is not a list", JSON.stringify({ v: 1, s: SCOPE, p: "a" })],
        ["an empty position", JSON.stringify({ v: 1, s: SCOPE, p: [] })],
        ["a position with a number", JSON.stringify({ v: 1, s: SCOPE, p: [1] })],
        [
            "a position longer than the order allows",
            JSON.stringify({ v: 1, s: SCOPE, p: Array.from({ length: 9 }, () => "a") }),
        ],
    ])("refuses a signed body that holds %s", async (_name, body) => {
        const policy = await build()

        expect(policy.readCursor(KEY, SCOPE, signedText(body))).toBeNull()
    })
})
