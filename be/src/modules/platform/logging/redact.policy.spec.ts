import { REDACTED, isSecretKey, redactFields, redactString, redactValue } from "./redact.policy"

/** Fixtures shaped like credentials, built at run time so no credential-looking literal sits in the source. */
const FAKE_JWT = ["eyJ", "fake", "header0", ".", "eyJ", "fake", "body00", ".", "fakesig"].join("")
const FAKE_BOT_TOKEN = ["bot", "123456789", ":", "Z".repeat(12), "fakefakefake", "q".repeat(11)].join("")

describe("redactString", () => {
    it.each([
        ["a JWT", `token ${FAKE_JWT}`, "eyJfake"],
        ["a Telegram bot token", `${FAKE_BOT_TOKEN} failed`, "fakefakefake"],
        ["a bearer header", "Authorization: Bearer abcdef123456", "abcdef123456"],
        ["a credential in a URL", "https://api.test/hook?api_key=s3cr3tvalue&x=1", "s3cr3tvalue"],
        ["a password field", '{"password":"hunter22"}', "hunter22"],
        ["a long hex run", "key 0123456789abcdef0123456789abcdef01", "0123456789abcdef0123456789abcdef01"],
    ])("scrubs %s", (_name, input, secret) => {
        const out = redactString(input)

        expect(out).not.toContain(secret)
        expect(out).toContain(REDACTED)
    })

    it("keeps plain text, uuids and paths", () => {
        const text = "shift 3f1c2b9e-1d2a-4c3b-9a8e-0f1e2d3c4b5a not found at /v1/webhooks/telegram"

        expect(redactString(text)).toBe(text)
    })
})

describe("isSecretKey", () => {
    it("names credentials but not the identity keys of jobs and templates", () => {
        expect(isSecretKey("accessToken")).toBe(true)
        expect(isSecretKey("apiKey")).toBe(true)
        expect(isSecretKey("authorization")).toBe(true)
        expect(isSecretKey("templateKey")).toBe(false)
        expect(isSecretKey("dedupeKey")).toBe(false)
        expect(isSecretKey("workspaceId")).toBe(false)
    })
})

describe("redactValue", () => {
    it("drops secret-named values at any depth and scrubs strings", () => {
        expect(
            redactValue({
                workspaceId: "ws-1",
                nested: { refreshToken: "r", note: "Bearer abcdefghijk" },
                list: [{ secret: 1 }],
            }),
        ).toEqual({
            workspaceId: "ws-1",
            nested: { refreshToken: REDACTED, note: `Bearer ${REDACTED}` },
            list: [{ secret: REDACTED }],
        })
    })

    it("turns an error into its name and scrubbed message", () => {
        expect(redactValue(new TypeError("bad apikey=abcdef"))).toEqual({
            name: "TypeError",
            message: `bad apikey=${REDACTED}`,
        })
    })
})

describe("redactFields", () => {
    it("keeps the shape of a log line", () => {
        expect(redactFields({ queue: "shifts_alerts", attempt: 2, token: "t" })).toEqual({
            queue: "shifts_alerts",
            attempt: 2,
            token: REDACTED,
        })
    })
})
