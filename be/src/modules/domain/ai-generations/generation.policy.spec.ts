import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { GenerateParams, GenerationInput } from "./ai-generations.contracts"
import {
    DEFAULT_TIMEOUT_MS,
    isPlainObject,
    clampTimeout,
    turnTimeoutOf,
    purposeOf,
    inputJsonOf,
    inputOf,
    usageOf,
    timingsOf,
    progressOf,
    queuedOf,
    verdictOf,
    isWaiting,
    promptOf,
    runUsageOf,
} from "./generation.policy"

const SUBJECT = Symbol("generation.policy")
type Subject = {
    isPlainObject: typeof isPlainObject
    clampTimeout: typeof clampTimeout
    turnTimeoutOf: typeof turnTimeoutOf
    purposeOf: typeof purposeOf
    inputJsonOf: typeof inputJsonOf
    inputOf: typeof inputOf
    usageOf: typeof usageOf
    timingsOf: typeof timingsOf
    progressOf: typeof progressOf
    queuedOf: typeof queuedOf
    verdictOf: typeof verdictOf
    isWaiting: typeof isWaiting
    promptOf: typeof promptOf
    runUsageOf: typeof runUsageOf
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    isPlainObject,
                    clampTimeout,
                    turnTimeoutOf,
                    purposeOf,
                    inputJsonOf,
                    inputOf,
                    usageOf,
                    timingsOf,
                    progressOf,
                    queuedOf,
                    verdictOf,
                    isWaiting,
                    promptOf,
                    runUsageOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const paramsOf = builder<GenerateParams>({
    workspaceId: "w1",
    purpose: "relay",
    messages: [{ role: "user", content: "hi" }],
    responseFormat: "text",
    kind: "relay",
    module: "office",
})

const USAGE = { prompt_tokens: 10, completion_tokens: 5, cached_tokens: 2, cost: 0.5, model: "m" }

const inputFor = builder<GenerationInput>({ messages: [], responseFormat: "text", timeoutMs: 1000 })

describe("generation policy deadlines", () => {
    it("keeps the caller's deadline between five and one hundred twenty seconds and defaults it", async () => {
        const subject = await buildSubject()
        expect(subject.clampTimeout(undefined)).toBe(DEFAULT_TIMEOUT_MS)
        expect(subject.clampTimeout(1000)).toBe(5000)
        expect(subject.clampTimeout(60_000)).toBe(60_000)
        expect(subject.clampTimeout(900_000)).toBe(120_000)
    })

    it("gives the turn the deadline less a margin, at least five seconds", async () => {
        const subject = await buildSubject()
        expect(subject.turnTimeoutOf(45_000)).toBe(42_000)
        expect(subject.turnTimeoutOf(5000)).toBe(5000)
    })
})

describe("generation policy row text", () => {
    it("clips the purpose", async () => {
        const subject = await buildSubject()
        expect(subject.purposeOf("x".repeat(80))).toHaveLength(60)
    })

    it("stores the prompt, the format and the deadline", async () => {
        const subject = await buildSubject()
        const stored = subject.inputJsonOf(paramsOf({ responseFormat: "json" }), 9000)

        expect(stored).toEqual({
            messages: [{ role: "user", content: "hi" }],
            response_format: "json",
            timeout_ms: 9000,
        })
    })
})

describe("generation policy inputOf", () => {
    it("reads a stored input back", async () => {
        const subject = await buildSubject()
        expect(
            subject.inputOf({
                messages: [{ role: "system", content: "s" }, { role: "robot", content: "x" }, 4],
                response_format: "json",
                timeout_ms: 7000,
            }),
        ).toEqual({ messages: [{ role: "system", content: "s" }], responseFormat: "json", timeoutMs: 7000 })
    })

    it("falls back to defaults for a missing or malformed input", async () => {
        const subject = await buildSubject()
        const fallback = { messages: [], responseFormat: "text", timeoutMs: DEFAULT_TIMEOUT_MS }

        expect(subject.inputOf(null)).toEqual(fallback)
        expect(subject.inputOf({ messages: "no", response_format: "xml", timeout_ms: "soon" })).toEqual(fallback)
    })
})

describe("generation policy usageOf and timingsOf", () => {
    it("reads a usage shape and refuses anything else", async () => {
        const subject = await buildSubject()
        expect(subject.usageOf(USAGE)).toEqual(USAGE)
        expect(subject.usageOf({ ...USAGE, model: 3 })).toEqual({ ...USAGE, model: null })
        expect(subject.usageOf({ ...USAGE, cost: "free" })).toBeNull()
        expect(subject.usageOf({ ...USAGE, prompt_tokens: "1" })).toBeNull()
        expect(subject.usageOf({ ...USAGE, completion_tokens: null })).toBeNull()
        expect(subject.usageOf({ ...USAGE, cached_tokens: undefined })).toBeNull()
        expect(subject.usageOf("nope")).toBeNull()
    })

    it("keeps the numeric marks only", async () => {
        const subject = await buildSubject()
        expect(subject.timingsOf({ total_ms: 5, note: "x", bad: Number.NaN })).toEqual({ total_ms: 5 })
        expect(subject.timingsOf(null)).toEqual({})
    })
})

describe("generation policy progress and verdict", () => {
    it("maps a polled row", async () => {
        const subject = await buildSubject()
        const progress = subject.progressOf({
            status: "done",
            output: { text: "hello" },
            usage: USAGE,
            timings: { a: 1 },
        })

        expect(progress).toEqual({ status: "done", text: "hello", usage: USAGE, timings: { a: 1 } })
        expect(subject.progressOf({ status: "queued", output: null, usage: null, timings: {} }).text).toBeNull()
        expect(subject.progressOf({ status: "done", output: { text: 3 }, usage: null, timings: {} }).text).toBeNull()
    })

    it("says done only with text, failed on error or cancel, and waiting otherwise", async () => {
        const subject = await buildSubject()
        const base = { usage: null, timings: {} }

        expect(subject.verdictOf({ ...base, status: "done", text: "t" })).toEqual({
            kind: "done",
            text: "t",
            progress: { ...base, status: "done", text: "t" },
        })
        expect(subject.verdictOf({ ...base, status: "done", text: null })).toBeNull()
        expect(subject.verdictOf({ ...base, status: "error", text: null })).toEqual({ kind: "failed" })
        expect(subject.verdictOf({ ...base, status: "cancelled", text: null })).toEqual({ kind: "failed" })
        expect(subject.verdictOf({ ...base, status: "running", text: null })).toBeNull()
    })

    it("treats queued and running rows as waiting", async () => {
        const subject = await buildSubject()
        expect(subject.isWaiting("queued")).toBe(true)
        expect(subject.isWaiting("running")).toBe(true)
        expect(subject.isWaiting("done")).toBe(false)
    })
})

describe("generation policy queuedOf", () => {
    it("maps a generation row", async () => {
        const subject = await buildSubject()
        const queued = subject.queuedOf({
            id: "g1",
            workspaceId: "w1",
            purpose: "relay",
            module: "office",
            usageKind: "relay",
            status: "queued",
            input: { messages: [], response_format: "text", timeout_ms: 8000 },
        })

        expect(queued).toEqual({
            id: "g1",
            workspaceId: "w1",
            purpose: "relay",
            module: "office",
            usageKind: "relay",
            status: "queued",
            input: { messages: [], responseFormat: "text", timeoutMs: 8000 },
        })
    })
})

describe("generation policy promptOf", () => {
    it("keeps the messages the app wrote in their order and ends with the form of the answer", async () => {
        const subject = await buildSubject()
        const prompt = subject.promptOf(
            inputFor({
                responseFormat: "json",
                messages: [
                    { role: "system", content: "be brief" },
                    { role: "user", content: "first" },
                    { role: "assistant", content: "answer" },
                    { role: "user", content: "last" },
                ],
            }),
        )

        expect(prompt).toEqual([
            { role: "system", content: "be brief" },
            { role: "user", content: "first" },
            { role: "assistant", content: "answer" },
            { role: "user", content: "last" },
            { role: "system", content: "Answer with ONLY the JSON object described above. No prose, no code fences." },
        ])
    })

    it("handles an empty prompt", async () => {
        const subject = await buildSubject()
        expect(subject.promptOf(inputFor())).toEqual([
            { role: "system", content: "Answer with ONLY the requested text. No preface, no explanation." },
        ])
    })
})

describe("generation policy runUsageOf", () => {
    it("maps what the endpoint reported, counting what it did not say as zero", async () => {
        const subject = await buildSubject()
        expect(
            subject.runUsageOf({ promptTokens: 10, completionTokens: 5, totalTokens: 15, costUsd: 0.5 }, "m"),
        ).toEqual({ prompt_tokens: 10, completion_tokens: 5, cached_tokens: 0, cost: 0.5, model: "m" })
        expect(
            subject.runUsageOf({ promptTokens: null, completionTokens: null, totalTokens: null, costUsd: null }, "m"),
        ).toEqual({ prompt_tokens: 0, completion_tokens: 0, cached_tokens: 0, cost: 0, model: "m" })
    })
})
