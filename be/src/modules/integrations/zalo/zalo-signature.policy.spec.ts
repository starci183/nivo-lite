import { Test } from "@nestjs/testing"
import { createHash } from "node:crypto"
import { ZaloErrorCode } from "./errors/zalo.error"
import { isValidZaloMac } from "./zalo-signature.policy"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** A by-constructor matcher, typed `unknown` so it flows into any slot. */
const anyOf = (type: unknown): unknown => expect.any(type)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const SUBJECT = Symbol("zalo-signature.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isValidZaloMac } }],
    }).compile()
    return moduleRef.get<typeof import("./zalo-signature.policy")>(SUBJECT)
}

const APP_ID = "app-1"
const SECRET = "oa-secret"
const BODY = JSON.stringify({ app_id: APP_ID, event_name: "user_send_text", timestamp: 1730000000000 })

const macOf = (body: string, timestamp: string, secret = SECRET): string =>
    createHash("sha256").update(`${APP_ID}${body}${timestamp}${secret}`).digest("hex")

describe("isValidZaloMac", () => {
    it("accepts the mac of app id, raw body, event time and OA secret, with or without the mac= prefix", async () => {
        const subject = await buildSubject()

        const mac = macOf(BODY, "1730000000000")

        expect(subject.isValidZaloMac(APP_ID, BODY, SECRET, `mac=${mac}`)).toBe(true)
        expect(subject.isValidZaloMac(APP_ID, BODY, SECRET, ` MAC=${mac.toUpperCase()} `)).toBe(true)
        expect(subject.isValidZaloMac(APP_ID, BODY, SECRET, mac)).toBe(true)
    })

    it("reads a string event time as well", async () => {
        const subject = await buildSubject()

        const body = JSON.stringify({ timestamp: "1730000000000" })

        expect(subject.isValidZaloMac(APP_ID, body, SECRET, macOf(body, "1730000000000"))).toBe(true)
    })

    it("refuses a mac made with another secret or over another body", async () => {
        const subject = await buildSubject()

        const mac = macOf(BODY, "1730000000000")

        expect(subject.isValidZaloMac(APP_ID, BODY, "other", mac)).toBe(false)
        expect(subject.isValidZaloMac(APP_ID, `${BODY} `, SECRET, mac)).toBe(false)
    })

    it("fails closed when the header, the app id or the secret is missing", async () => {
        const subject = await buildSubject()

        const mac = macOf(BODY, "1730000000000")

        expect(subject.isValidZaloMac(APP_ID, BODY, SECRET)).toBe(false)
        expect(subject.isValidZaloMac("", BODY, SECRET, mac)).toBe(false)
        expect(subject.isValidZaloMac(APP_ID, BODY, "", mac)).toBe(false)
    })

    it("fails closed when the body carries no usable event time", async () => {
        const subject = await buildSubject()

        expect(subject.isValidZaloMac(APP_ID, "null", SECRET, "abc")).toBe(false)
        expect(subject.isValidZaloMac(APP_ID, JSON.stringify({ timestamp: true }), SECRET, "abc")).toBe(false)
        expect(subject.isValidZaloMac(APP_ID, JSON.stringify({}), SECRET, "abc")).toBe(false)
    })

    it("refuses with a ZaloError, carrying the cause, when the body is not JSON", async () => {
        const subject = await buildSubject()

        expect(thrownBy(() => subject.isValidZaloMac(APP_ID, "not json", SECRET, "abc"))).toEqual(
            objectLike({ code: ZaloErrorCode.BodyUnreadable, cause: anyOf(SyntaxError) }),
        )
    })
})
