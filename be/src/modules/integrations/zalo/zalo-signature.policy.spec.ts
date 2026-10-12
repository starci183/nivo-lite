import { createHash } from "node:crypto"
import { isValidZaloMac } from "./zalo-signature.policy"

const APP_ID = "app-1"
const SECRET = "oa-secret"
const BODY = JSON.stringify({ app_id: APP_ID, event_name: "user_send_text", timestamp: 1730000000000 })

const macOf = (body: string, timestamp: string, secret = SECRET): string =>
    createHash("sha256").update(`${APP_ID}${body}${timestamp}${secret}`).digest("hex")

describe("isValidZaloMac", () => {
    it("accepts the mac of app id, raw body, event time and OA secret, with or without the mac= prefix", () => {
        const mac = macOf(BODY, "1730000000000")

        expect(isValidZaloMac(`mac=${mac}`, APP_ID, BODY, SECRET)).toBe(true)
        expect(isValidZaloMac(` MAC=${mac.toUpperCase()} `, APP_ID, BODY, SECRET)).toBe(true)
        expect(isValidZaloMac(mac, APP_ID, BODY, SECRET)).toBe(true)
    })

    it("reads a string event time as well", () => {
        const body = JSON.stringify({ timestamp: "1730000000000" })

        expect(isValidZaloMac(macOf(body, "1730000000000"), APP_ID, body, SECRET)).toBe(true)
    })

    it("refuses a mac made with another secret or over another body", () => {
        const mac = macOf(BODY, "1730000000000")

        expect(isValidZaloMac(mac, APP_ID, BODY, "other")).toBe(false)
        expect(isValidZaloMac(mac, APP_ID, `${BODY} `, SECRET)).toBe(false)
    })

    it("fails closed when the header, the app id or the secret is missing", () => {
        const mac = macOf(BODY, "1730000000000")

        expect(isValidZaloMac(undefined, APP_ID, BODY, SECRET)).toBe(false)
        expect(isValidZaloMac(mac, "", BODY, SECRET)).toBe(false)
        expect(isValidZaloMac(mac, APP_ID, BODY, "")).toBe(false)
    })

    it("fails closed when the body is not JSON or carries no usable event time", () => {
        expect(isValidZaloMac("abc", APP_ID, "not json", SECRET)).toBe(false)
        expect(isValidZaloMac("abc", APP_ID, "null", SECRET)).toBe(false)
        expect(isValidZaloMac("abc", APP_ID, JSON.stringify({ timestamp: true }), SECRET)).toBe(false)
        expect(isValidZaloMac("abc", APP_ID, JSON.stringify({}), SECRET)).toBe(false)
    })
})
