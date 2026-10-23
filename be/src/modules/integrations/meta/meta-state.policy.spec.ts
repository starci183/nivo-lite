import { Test } from "@nestjs/testing"

import { createHmac } from "node:crypto"

import { MetaErrorCode } from "./errors/meta.error"

import { metaReturnTo, metaStateKey, signMetaState, verifyMetaState } from "./meta-state.policy"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const POLICY = Symbol("./meta-state.policy")

type PolicySubject = {
    metaReturnTo: typeof metaReturnTo
    metaStateKey: typeof metaStateKey
    signMetaState: typeof signMetaState
    verifyMetaState: typeof verifyMetaState
}

const NOW = 1_800_000_000_000

const TTL = 10 * 60 * 1000

const INPUT = { workspaceId: "ws-1", userId: "u-1", returnTo: "/connections?connect=meta&id=c-1" }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: POLICY, useValue: { metaReturnTo, metaStateKey, signMetaState, verifyMetaState } }],
    }).compile()
    const subject = moduleRef.get<PolicySubject>(POLICY)
    const KEY = subject.metaStateKey(Buffer.alloc(32, 5).toString("base64"))
    const signedBody = (body: object, key: Buffer = KEY): string => {
        const encoded = Buffer.from(JSON.stringify(body)).toString("base64url")
        return `${encoded}.${createHmac("sha256", key).update(encoded).digest().toString("base64url")}`
    }
    return { subject, KEY, signedBody }
}

describe("metaReturnTo", () => {
    it("keeps a same-site path and refuses the rest", async () => {
        const { subject } = await buildSubject()

        expect(subject.metaReturnTo("/agents")).toBe("/agents")
        expect(subject.metaReturnTo("//evil")).toBe("/connections")
        expect(subject.metaReturnTo("/a\nb")).toBe("/connections")
        expect(subject.metaReturnTo(undefined)).toBe("/connections")
    })
})

describe("metaStateKey", () => {
    it("derives a 32 byte key and refuses a short channel key", async () => {
        const { subject, KEY } = await buildSubject()

        expect(KEY).toHaveLength(32)
        expect(thrownBy(() => subject.metaStateKey("c2hvcnQ="))).toEqual(
            objectLike({ code: MetaErrorCode.NotConfigured }),
        )
    })
})

describe("signMetaState and verifyMetaState", () => {
    it("round-trips a state that carries the Meta purpose", async () => {
        const { subject, KEY } = await buildSubject()

        expect(subject.verifyMetaState(KEY, subject.signMetaState(KEY, INPUT, NOW), NOW)).toEqual({
            w: "ws-1",
            u: "u-1",
            r: "/connections?connect=meta&id=c-1",
            e: NOW + TTL,
            p: "meta",
        })
    })

    it("refuses a missing, malformed, tampered, foreign or expired state", async () => {
        const { subject, KEY } = await buildSubject()

        const good = subject.signMetaState(KEY, INPUT, NOW)
        const [body = ""] = good.split(".")

        expect(subject.verifyMetaState(KEY, undefined, NOW)).toBeNull()
        expect(subject.verifyMetaState(KEY, "onlybody", NOW)).toBeNull()
        expect(subject.verifyMetaState(KEY, `${good}.x`, NOW)).toBeNull()
        expect(subject.verifyMetaState(KEY, `${body}.AAAA`, NOW)).toBeNull()
        expect(
            subject.verifyMetaState(subject.metaStateKey(Buffer.alloc(32, 6).toString("base64")), good, NOW),
        ).toBeNull()
        expect(subject.verifyMetaState(KEY, good, NOW + TTL + 1)).toBeNull()
    })

    it("refuses a body that is not a Meta state", async () => {
        const { subject, KEY, signedBody } = await buildSubject()

        expect(subject.verifyMetaState(KEY, signedBody({ w: "a", u: "b", r: "/x", e: NOW + 5 }), NOW)).toBeNull()
        expect(
            subject.verifyMetaState(KEY, signedBody({ w: "a", u: "b", r: "/x", e: NOW + 5, p: "drive_read" }), NOW),
        ).toBeNull()
        expect(subject.verifyMetaState(KEY, signedBody({ w: "a", u: "b", r: "/x", e: NOW + 5, p: 1 }), NOW)).toBeNull()
        expect(subject.verifyMetaState(KEY, signedBody({ w: 1 }), NOW)).toBeNull()
        const raw = Buffer.from("not json").toString("base64url")
        expect(
            subject.verifyMetaState(
                KEY,
                `${raw}.${createHmac("sha256", KEY).update(raw).digest().toString("base64url")}`,
                NOW,
            ),
        ).toBeNull()
        const nul = Buffer.from("null").toString("base64url")
        expect(
            subject.verifyMetaState(
                KEY,
                `${nul}.${createHmac("sha256", KEY).update(nul).digest().toString("base64url")}`,
                NOW,
            ),
        ).toBeNull()
    })
})
