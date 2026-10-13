import { createHmac } from "node:crypto"
import { GoogleErrorCode } from "./errors/google.error"
import { STATE_TTL_MS } from "./google.contracts"
import { safeReturnTo, signState, stateKey, verifyState, withResult } from "./google-state.policy"

const NOW = 1_800_000_000_000
const KEY = stateKey(Buffer.alloc(32, 7).toString("base64"))
const INPUT = { workspaceId: "ws-1", userId: "user-1", returnTo: "/connections?x=1" }

const signedBody = (body: object, key: Buffer = KEY): string => {
    const encoded = Buffer.from(JSON.stringify(body)).toString("base64url")
    return `${encoded}.${createHmac("sha256", key).update(encoded).digest().toString("base64url")}`
}

describe("safeReturnTo", () => {
    it("keeps a same-site path and refuses everything else", () => {
        expect(safeReturnTo("/agents?tab=1")).toBe("/agents?tab=1")
        expect(safeReturnTo("//evil.test")).toBe("/connections")
        expect(safeReturnTo("/\\evil")).toBe("/connections")
        expect(safeReturnTo("/ok\r\nSet-Cookie: x")).toBe("/connections")
        expect(safeReturnTo("https://evil.test")).toBe("/connections")
        expect(safeReturnTo(null)).toBe("/connections")
        expect(safeReturnTo(undefined)).toBe("/connections")
    })
})

describe("withResult", () => {
    it("adds the result and the reason to the query", () => {
        expect(withResult("/connections", "ok")).toBe("/connections?google=ok")
        expect(withResult("/connections?a=1", "error", "denied")).toBe("/connections?a=1&google=error&reason=denied")
        expect(withResult("/brain?reason=old", "ok", undefined, "drive")).toBe("/brain?drive=ok")
        expect(withResult("https://evil.test", "ok")).toBe("/connections?google=ok")
    })
})

describe("stateKey", () => {
    it("derives a 32 byte key and refuses a short channel key", () => {
        expect(KEY).toHaveLength(32)
        expect(() => stateKey("c2hvcnQ=")).toThrow(expect.objectContaining({ code: GoogleErrorCode.NotConfigured }))
    })
})

describe("signState and verifyState", () => {
    it("round-trips a state with its purpose and a safe return path", () => {
        const state = verifyState(KEY, signState(KEY, { ...INPUT, purpose: "drive_read" }, NOW), NOW)

        expect(state).toEqual({ w: "ws-1", u: "user-1", r: "/connections?x=1", e: NOW + STATE_TTL_MS, p: "drive_read" })
    })

    it("omits the purpose when there is none and sanitises the return path", () => {
        const state = verifyState(KEY, signState(KEY, { ...INPUT, returnTo: "//evil" }, NOW), NOW)

        expect(state).toEqual({ w: "ws-1", u: "user-1", r: "/connections", e: NOW + STATE_TTL_MS })
    })

    it("refuses a missing, malformed, tampered or foreign-signed value", () => {
        const good = signState(KEY, INPUT, NOW)
        const [body = ""] = good.split(".")

        expect(verifyState(KEY, null, NOW)).toBeNull()
        expect(verifyState(KEY, "", NOW)).toBeNull()
        expect(verifyState(KEY, "onlybody", NOW)).toBeNull()
        expect(verifyState(KEY, `${good}.extra`, NOW)).toBeNull()
        expect(verifyState(KEY, `${body}.AAAA`, NOW)).toBeNull()
        expect(verifyState(KEY, signedBody({ w: "ws-1" }, Buffer.alloc(32, 1)), NOW)).toBeNull()
    })

    it("refuses an expired state and a body that is not a state", () => {
        expect(verifyState(KEY, signState(KEY, INPUT, NOW), NOW + STATE_TTL_MS + 1)).toBeNull()
        expect(verifyState(KEY, signedBody({ w: "a", u: "b", r: "/x", e: NOW + 5 }), NOW)).not.toBeNull()
        expect(verifyState(KEY, signedBody({ w: 1, u: "b", r: "/x", e: NOW + 5 }), NOW)).toBeNull()
        expect(verifyState(KEY, signedBody({ w: "a", u: "b", r: "/x", e: NOW + 5, p: 3 }), NOW)).toBeNull()
        expect(verifyState(KEY, signedBody(["x"] as unknown as object), NOW)).toBeNull()
        const notJson = Buffer.from("not json").toString("base64url")
        expect(
            verifyState(
                KEY,
                `${notJson}.${createHmac("sha256", KEY).update(notJson).digest().toString("base64url")}`,
                NOW,
            ),
        ).toBeNull()
        const nullBody = Buffer.from("null").toString("base64url")
        expect(
            verifyState(
                KEY,
                `${nullBody}.${createHmac("sha256", KEY).update(nullBody).digest().toString("base64url")}`,
                NOW,
            ),
        ).toBeNull()
    })
})
