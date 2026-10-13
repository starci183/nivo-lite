import { createHmac } from "node:crypto"
import { MetaErrorCode } from "./errors/meta.error"
import { metaStateKey, safeReturnTo, signMetaState, verifyMetaState } from "./meta-state.policy"

const NOW = 1_800_000_000_000
const TTL = 10 * 60 * 1000
const KEY = metaStateKey(Buffer.alloc(32, 5).toString("base64"))
const INPUT = { workspaceId: "ws-1", userId: "u-1", returnTo: "/connections?connect=meta&id=c-1" }

const signedBody = (body: object, key: Buffer = KEY): string => {
    const encoded = Buffer.from(JSON.stringify(body)).toString("base64url")
    return `${encoded}.${createHmac("sha256", key).update(encoded).digest().toString("base64url")}`
}

describe("safeReturnTo", () => {
    it("keeps a same-site path and refuses the rest", () => {
        expect(safeReturnTo("/agents")).toBe("/agents")
        expect(safeReturnTo("//evil")).toBe("/connections")
        expect(safeReturnTo("/a\nb")).toBe("/connections")
        expect(safeReturnTo(undefined)).toBe("/connections")
    })
})

describe("metaStateKey", () => {
    it("derives a 32 byte key and refuses a short channel key", () => {
        expect(KEY).toHaveLength(32)
        expect(() => metaStateKey("c2hvcnQ=")).toThrow(expect.objectContaining({ code: MetaErrorCode.NotConfigured }))
    })
})

describe("signMetaState and verifyMetaState", () => {
    it("round-trips a state that carries the Meta purpose", () => {
        expect(verifyMetaState(KEY, signMetaState(KEY, INPUT, NOW), NOW)).toEqual({
            w: "ws-1",
            u: "u-1",
            r: "/connections?connect=meta&id=c-1",
            e: NOW + TTL,
            p: "meta",
        })
    })

    it("refuses a missing, malformed, tampered, foreign or expired state", () => {
        const good = signMetaState(KEY, INPUT, NOW)
        const [body = ""] = good.split(".")

        expect(verifyMetaState(KEY, undefined, NOW)).toBeNull()
        expect(verifyMetaState(KEY, "onlybody", NOW)).toBeNull()
        expect(verifyMetaState(KEY, `${good}.x`, NOW)).toBeNull()
        expect(verifyMetaState(KEY, `${body}.AAAA`, NOW)).toBeNull()
        expect(verifyMetaState(metaStateKey(Buffer.alloc(32, 6).toString("base64")), good, NOW)).toBeNull()
        expect(verifyMetaState(KEY, good, NOW + TTL + 1)).toBeNull()
    })

    it("refuses a body that is not a Meta state", () => {
        expect(verifyMetaState(KEY, signedBody({ w: "a", u: "b", r: "/x", e: NOW + 5 }), NOW)).toBeNull()
        expect(
            verifyMetaState(KEY, signedBody({ w: "a", u: "b", r: "/x", e: NOW + 5, p: "drive_read" }), NOW),
        ).toBeNull()
        expect(verifyMetaState(KEY, signedBody({ w: "a", u: "b", r: "/x", e: NOW + 5, p: 1 }), NOW)).toBeNull()
        expect(verifyMetaState(KEY, signedBody({ w: 1 }), NOW)).toBeNull()
        const raw = Buffer.from("not json").toString("base64url")
        expect(
            verifyMetaState(KEY, `${raw}.${createHmac("sha256", KEY).update(raw).digest().toString("base64url")}`, NOW),
        ).toBeNull()
        const nul = Buffer.from("null").toString("base64url")
        expect(
            verifyMetaState(KEY, `${nul}.${createHmac("sha256", KEY).update(nul).digest().toString("base64url")}`, NOW),
        ).toBeNull()
    })
})
