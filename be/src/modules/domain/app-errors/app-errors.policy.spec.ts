import { Test } from "@nestjs/testing"
import {
    clean as realClean,
    clip as realClip,
    messageOf as realMessageOf,
    uuidOrNull as realUuidOrNull,
} from "./app-errors.policy"

const SUBJECT = Symbol("app-errors.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { clean: realClean, clip: realClip, messageOf: realMessageOf, uuidOrNull: realUuidOrNull },
            },
        ],
    }).compile()
    const subject = moduleRef.get<{
        clean: typeof realClean
        clip: typeof realClip
        messageOf: typeof realMessageOf
        uuidOrNull: typeof realUuidOrNull
    }>(SUBJECT)
    return { subject }
}

describe("clip", () => {
    it("cuts a long text and marks the cut", async () => {
        const { subject } = await buildSubject()

        expect(subject.clip("abcdef", 3)).toBe("abc…")
        expect(subject.clip("abc", 3)).toBe("abc")
    })
})

describe("clean", () => {
    it("scrubs credentials and bounds the length", async () => {
        const { subject } = await buildSubject()

        const out = subject.clean("failed with token=abcdef123 after retry", 200)

        expect(out).not.toContain("abcdef123")
        expect(subject.clean("x".repeat(50), 10)).toHaveLength(11)
    })
})

describe("messageOf", () => {
    it("reads an error, a text and any other value", async () => {
        const { subject } = await buildSubject()

        expect(subject.messageOf(new Error("boom"))).toBe("boom")
        expect(subject.messageOf("plain")).toBe("plain")
        expect(subject.messageOf({ code: 7, password: "p" })).toBe('{"code":7,"password":"[redacted]"}')
    })

    it("falls back to text when redaction has no JSON representation", async () => {
        const { subject } = await buildSubject()

        expect(subject.messageOf(undefined)).toBe("undefined")
        expect(subject.messageOf(Symbol("failed"))).toBe("Symbol(failed)")
        expect(subject.messageOf(null)).toBe("null")
    })
})

describe("uuidOrNull", () => {
    it("keeps only a uuid", async () => {
        const { subject } = await buildSubject()

        expect(subject.uuidOrNull("3f1c2b9e-1d2a-4c3b-9a8e-0f1e2d3c4b5a")).toBe("3f1c2b9e-1d2a-4c3b-9a8e-0f1e2d3c4b5a")
        expect(subject.uuidOrNull("ws-1")).toBeNull()
        expect(subject.uuidOrNull(null)).toBeNull()
    })
})
