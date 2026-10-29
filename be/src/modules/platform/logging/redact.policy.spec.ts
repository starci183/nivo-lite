import { Test } from "@nestjs/testing"
import { REDACTED, isSecretKey, redactFields, redactString, redactValue } from "./redact.policy"

const SUBJECT = Symbol("redact.policy")

type PolicySubject = {
    redactString: typeof redactString
    isSecretKey: typeof isSecretKey
    redactValue: typeof redactValue
    redactFields: typeof redactFields
}
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    redactString,
                    isSecretKey,
                    redactValue,
                    redactFields,
                },
            },
        ],
    }).compile()
    return moduleRef.get<PolicySubject>(SUBJECT)
}

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
    ])("scrubs %s", async (_name, input, secret) => {
        const subject = await buildSubject()

        const out = subject.redactString(input)

        expect(out).not.toContain(secret)
        expect(out).toContain(REDACTED)
    })

    it("keeps plain text, uuids and paths", async () => {
        const subject = await buildSubject()

        const text = "shift 3f1c2b9e-1d2a-4c3b-9a8e-0f1e2d3c4b5a not found at /v1/webhooks/telegram"

        expect(subject.redactString(text)).toBe(text)
    })

    it("replaces mixed-case base64-looking runs containing digits", async () => {
        const subject = await buildSubject()

        const credential = ["aB3", "xY9".repeat(11), "=="].join("")

        expect(subject.redactString(`encoded ${credential} end`)).toBe(`encoded ${REDACTED} end`)
    })

    it.each([
        ["lowercase and digits", "x3".repeat(18)],
        ["uppercase and digits", "X3".repeat(18)],
        ["mixed case without digits", "xY".repeat(18)],
    ])("preserves long runs of %s", async (_name, input) => {
        const subject = await buildSubject()

        expect(subject.redactString(input)).toBe(input)
    })
})

describe("isSecretKey", () => {
    it("names credentials but not the identity keys of jobs and templates", async () => {
        const subject = await buildSubject()

        expect(subject.isSecretKey("accessToken")).toBe(true)
        expect(subject.isSecretKey("apiKey")).toBe(true)
        expect(subject.isSecretKey("authorization")).toBe(true)
        expect(subject.isSecretKey("templateKey")).toBe(false)
        expect(subject.isSecretKey("dedupeKey")).toBe(false)
        expect(subject.isSecretKey("workspaceId")).toBe(false)
    })
})

describe("redactValue", () => {
    it("drops secret-named values at any depth and scrubs strings", async () => {
        const subject = await buildSubject()

        expect(
            subject.redactValue({
                workspaceId: "ws-1",
                nested: { accessToken: "r", note: "Bearer abcdefghijk" },
                list: [{ secret: 1 }],
            }),
        ).toEqual({
            workspaceId: "ws-1",
            nested: { accessToken: REDACTED, note: `Bearer ${REDACTED}` },
            list: [{ secret: REDACTED }],
        })
    })

    it("turns an error into its name and scrubbed message", async () => {
        const subject = await buildSubject()

        expect(subject.redactValue(new TypeError("bad apikey=abcdef"))).toEqual({
            name: "TypeError",
            message: `bad apikey=${REDACTED}`,
        })
    })

    it.each([
        ["null", null, null],
        ["undefined", undefined, undefined],
        ["a number", 23, 23],
        ["a boolean", false, false],
        ["a bigint", BigInt("12345678901234567890"), "12345678901234567890"],
        ["a function", () => "unused", undefined],
        ["a symbol", Symbol("unused"), undefined],
    ])("scrubs %s into its safe primitive form", async (_name, input, expected) => {
        const subject = await buildSubject()

        expect(subject.redactValue(input)).toBe(expected)
    })

    it("serializes dates in their ISO form", async () => {
        const subject = await buildSubject()

        expect(subject.redactValue(new Date("2026-02-03T04:05:06.000Z"))).toBe("2026-02-03T04:05:06.000Z")
    })

    it("truncates objects after eight levels of nesting", async () => {
        const subject = await buildSubject()

        const input = { a: { b: { c: { d: { e: { f: { g: { h: { note: "hidden" } } } } } } } } }
        expect(subject.redactValue(input)).toEqual({
            a: { b: { c: { d: { e: { f: { g: { h: "[truncated]" } } } } } } },
        })
    })

    it("bounds arrays to sixty entries and scrubs each retained value", async () => {
        const subject = await buildSubject()

        const input = Array.from({ length: 61 }, (_value, index) => ({ index, password: `value-${index}` }))
        const expected = Array.from({ length: 60 }, (_value, index) => ({ index, password: REDACTED }))

        expect(subject.redactValue(input)).toEqual(expected)
    })

    it("bounds records to their first sixty entries", async () => {
        const subject = await buildSubject()

        const input = Object.fromEntries(Array.from({ length: 61 }, (_value, index) => [`field${index}`, index]))
        const expected = Object.fromEntries(Array.from({ length: 60 }, (_value, index) => [`field${index}`, index]))

        expect(subject.redactValue(input)).toEqual(expected)
    })
})

describe("redactFields", () => {
    it("keeps the shape of a log line", async () => {
        const subject = await buildSubject()

        expect(subject.redactFields({ queue: "shifts_alerts", attempt: 2, token: "t" })).toEqual({
            queue: "shifts_alerts",
            attempt: 2,
            token: REDACTED,
        })
    })
})

describe("credential assignment boundaries", () => {
    it.each([
        ["safe=token=abc", "safe=token=[redacted]"],
        ['{"password":"abc"}', '{"password":"[redacted]"}'],
        ["?api-key=abc&safe=123", "?api-key=[redacted]&safe=123"],
        ["token=ab", "token=ab"],
        ["token=abc:def", "token=[redacted]"],
        ["safe=abc token=def", "safe=abc token=[redacted]"],
        ["prefixsecretSuffix = abc", "prefixsecretSuffix = [redacted]"],
        ["\u017fecret=abc", "\u017fecret=[redacted]"],
    ])("preserves exact masking for %s", async (input, expected) => {
        const subject = await buildSubject()

        expect(subject.redactString(input)).toBe(expected)
    })

    it("preserves a long ordinary name without an assignment", async () => {
        const subject = await buildSubject()
        const input = "ordinary".repeat(10000)

        expect(subject.redactString(input)).toBe(input)
    })
})
