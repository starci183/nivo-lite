import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { GenerateParams, GenerationInput } from "./ai-generations.contracts"
import {
    DEFAULT_TIMEOUT_MS,
    isPlainObject,
    clampTimeout,
    turnTimeoutOf,
    purposeOf,
    failureTextOf,
    inputJsonOf,
    inputOf,
    usageOf,
    timingsOf,
    progressOf,
    queuedOf,
    verdictOf,
    isWaiting,
    composeTurn,
    isTimeoutCause,
    untilAborted,
} from "./generation.policy"

const SUBJECT = Symbol("generation.policy")
type Subject = {
    isPlainObject: typeof isPlainObject
    clampTimeout: typeof clampTimeout
    turnTimeoutOf: typeof turnTimeoutOf
    purposeOf: typeof purposeOf
    failureTextOf: typeof failureTextOf
    inputJsonOf: typeof inputJsonOf
    inputOf: typeof inputOf
    usageOf: typeof usageOf
    timingsOf: typeof timingsOf
    progressOf: typeof progressOf
    queuedOf: typeof queuedOf
    verdictOf: typeof verdictOf
    isWaiting: typeof isWaiting
    composeTurn: typeof composeTurn
    isTimeoutCause: typeof isTimeoutCause
    untilAborted: typeof untilAborted
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
                    failureTextOf,
                    inputJsonOf,
                    inputOf,
                    usageOf,
                    timingsOf,
                    progressOf,
                    queuedOf,
                    verdictOf,
                    isWaiting,
                    composeTurn,
                    isTimeoutCause,
                    untilAborted,
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

    it("recognizes timeout and abort errors only", async () => {
        const subject = await buildSubject()
        const timeout = new Error("deadline passed")
        timeout.name = "TimeoutError"
        const abort = new Error("request aborted")
        abort.name = "AbortError"

        expect(subject.isTimeoutCause(timeout)).toBe(true)
        expect(subject.isTimeoutCause(abort)).toBe(true)
        expect(subject.isTimeoutCause(new Error("ordinary failure"))).toBe(false)
        expect(subject.isTimeoutCause({ name: "TimeoutError" })).toBe(false)
        expect(subject.isTimeoutCause(null)).toBe(false)
    })
})

describe("generation policy untilAborted", () => {
    it("resolves with the work and removes its abort listener", async () => {
        const subject = await buildSubject()
        const controller = new AbortController()
        const addListener = jest.spyOn(controller.signal, "addEventListener")
        const removeListener = jest.spyOn(controller.signal, "removeEventListener")

        await expect(subject.untilAborted(Promise.resolve("delivered"), controller.signal)).resolves.toBe("delivered")

        expect(addListener.mock.calls).toEqual([["abort", expect.any(Function), { once: true }]])
        expect(removeListener.mock.calls).toEqual([["abort", addListener.mock.calls[0]?.[1]]])
    })

    it("rejects with the work's error and removes its abort listener", async () => {
        const subject = await buildSubject()
        const controller = new AbortController()
        const addListener = jest.spyOn(controller.signal, "addEventListener")
        const removeListener = jest.spyOn(controller.signal, "removeEventListener")
        const failure = new Error("work failed")

        await expect(subject.untilAborted(Promise.reject(failure), controller.signal)).rejects.toBe(failure)

        expect(addListener.mock.calls).toEqual([["abort", expect.any(Function), { once: true }]])
        expect(removeListener.mock.calls).toEqual([["abort", addListener.mock.calls[0]?.[1]]])
    })

    it("rejects with the reason of an already aborted signal without attaching a listener", async () => {
        const subject = await buildSubject()
        const controller = new AbortController()
        const addListener = jest.spyOn(controller.signal, "addEventListener")
        const removeListener = jest.spyOn(controller.signal, "removeEventListener")
        const reason = new Error("deadline already passed")
        controller.abort(reason)

        await expect(subject.untilAborted(Promise.resolve("too late"), controller.signal)).rejects.toBe(reason)

        expect(addListener).not.toHaveBeenCalled()
        expect(removeListener).not.toHaveBeenCalled()
    })

    it("rejects with the signal's reason when it aborts while the work remains pending", async () => {
        const subject = await buildSubject()
        const controller = new AbortController()
        const work = new Promise<string>(() => undefined)
        const pending = subject.untilAborted(work, controller.signal)
        const reason = { message: "deadline passed" }

        controller.abort(reason)

        await expect(pending).rejects.toBe(reason)
    })
})

describe("generation policy row text", () => {
    it("clips the purpose and the failure text", async () => {
        const subject = await buildSubject()
        expect(subject.purposeOf("x".repeat(80))).toHaveLength(60)
        expect(subject.failureTextOf(new Error("e".repeat(300)))).toHaveLength(200)
        expect(subject.failureTextOf("plain")).toBe("plain")
    })

    it("stores the prompt, the format and the deadline", async () => {
        const subject = await buildSubject()
        const stored = subject.inputJsonOf(paramsOf({ responseFormat: "json" }), 9000)

        expect(stored).toBe(
            JSON.stringify({ messages: [{ role: "user", content: "hi" }], response_format: "json", timeout_ms: 9000 }),
        )
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
            workspace_id: "w1",
            purpose: "relay",
            module: "office",
            usage_kind: "relay",
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

describe("generation policy composeTurn", () => {
    it("puts the system prompt, the dialogue so far and the last line in order", async () => {
        const subject = await buildSubject()
        const text = subject.composeTurn(
            inputFor({
                responseFormat: "json",
                messages: [
                    { role: "system", content: "be brief" },
                    { role: "system", content: "be kind" },
                    { role: "user", content: "first" },
                    { role: "assistant", content: "answer" },
                    { role: "user", content: "last" },
                ],
            }),
        )

        expect(text).toBe(
            [
                "[REQUEST: follow these instructions exactly]",
                "be brief\n\nbe kind",
                "",
                "[CONVERSATION SO FAR]",
                "User: first\nNIVO: answer",
                "",
                "[INPUT]",
                "last",
                "",
                "[OUTPUT] Answer with ONLY the JSON object described above. No prose, no code fences.",
            ].join("\n"),
        )
    })

    it("handles an empty prompt", async () => {
        const subject = await buildSubject()
        expect(subject.composeTurn(inputFor())).toBe(
            [
                "[REQUEST: follow these instructions exactly]",
                "(no extra instructions)",
                "",
                "[INPUT]",
                "",
                "",
                "[OUTPUT] Answer with ONLY the requested text. No preface, no explanation.",
            ].join("\n"),
        )
    })
})
