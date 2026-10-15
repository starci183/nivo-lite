import { builder } from "@starci/jest-preset"
import type { GenerateParams, GenerationInput } from "./ai-generations.contracts"
import {
    DEFAULT_TIMEOUT_MS,
    clampTimeout,
    composeTurn,
    failureTextOf,
    inputJsonOf,
    inputOf,
    isTimeoutCause,
    isWaiting,
    progressOf,
    purposeOf,
    queuedOf,
    timingsOf,
    turnTimeoutOf,
    untilAborted,
    usageOf,
    verdictOf,
} from "./generation.policy"

const paramsOf = builder<GenerateParams>({
    workspaceId: "w1",
    purpose: "relay",
    messages: [{ role: "user", content: "hi" }],
    responseFormat: "text",
    kind: "relay",
    module: "office",
})

const USAGE = { prompt_tokens: 10, completion_tokens: 5, cached_tokens: 2, cost: 0.5, model: "m" }

describe("generation policy", () => {
    describe("deadlines", () => {
        it("keeps the caller's deadline between five and one hundred twenty seconds and defaults it", () => {
            expect(clampTimeout(undefined)).toBe(DEFAULT_TIMEOUT_MS)
            expect(clampTimeout(1000)).toBe(5000)
            expect(clampTimeout(60_000)).toBe(60_000)
            expect(clampTimeout(900_000)).toBe(120_000)
        })

        it("gives the turn the deadline less a margin, at least five seconds", () => {
            expect(turnTimeoutOf(45_000)).toBe(42_000)
            expect(turnTimeoutOf(5000)).toBe(5000)
        })

        it("recognizes timeout and abort errors only", () => {
            const timeout = new Error("deadline passed")
            timeout.name = "TimeoutError"
            const abort = new Error("request aborted")
            abort.name = "AbortError"

            expect(isTimeoutCause(timeout)).toBe(true)
            expect(isTimeoutCause(abort)).toBe(true)
            expect(isTimeoutCause(new Error("ordinary failure"))).toBe(false)
            expect(isTimeoutCause({ name: "TimeoutError" })).toBe(false)
            expect(isTimeoutCause(null)).toBe(false)
        })
    })

    describe("untilAborted", () => {
        it("resolves with the work and removes its abort listener", async () => {
            const controller = new AbortController()
            const addListener = jest.spyOn(controller.signal, "addEventListener")
            const removeListener = jest.spyOn(controller.signal, "removeEventListener")

            await expect(untilAborted(Promise.resolve("delivered"), controller.signal)).resolves.toBe("delivered")

            expect(addListener.mock.calls).toEqual([["abort", expect.any(Function), { once: true }]])
            expect(removeListener.mock.calls).toEqual([["abort", addListener.mock.calls[0]?.[1]]])
        })

        it("rejects with the work's error and removes its abort listener", async () => {
            const controller = new AbortController()
            const addListener = jest.spyOn(controller.signal, "addEventListener")
            const removeListener = jest.spyOn(controller.signal, "removeEventListener")
            const failure = new Error("work failed")

            await expect(untilAborted(Promise.reject(failure), controller.signal)).rejects.toBe(failure)

            expect(addListener.mock.calls).toEqual([["abort", expect.any(Function), { once: true }]])
            expect(removeListener.mock.calls).toEqual([["abort", addListener.mock.calls[0]?.[1]]])
        })

        it("rejects with the reason of an already aborted signal without attaching a listener", async () => {
            const controller = new AbortController()
            const addListener = jest.spyOn(controller.signal, "addEventListener")
            const removeListener = jest.spyOn(controller.signal, "removeEventListener")
            const reason = new Error("deadline already passed")
            controller.abort(reason)

            await expect(untilAborted(Promise.resolve("too late"), controller.signal)).rejects.toBe(reason)

            expect(addListener).not.toHaveBeenCalled()
            expect(removeListener).not.toHaveBeenCalled()
        })

        it("rejects with the signal's reason when it aborts while the work remains pending", async () => {
            const controller = new AbortController()
            const work = new Promise<string>(() => undefined)
            const pending = untilAborted(work, controller.signal)
            const reason = { message: "deadline passed" }

            controller.abort(reason)

            await expect(pending).rejects.toBe(reason)
        })
    })

    describe("row text", () => {
        it("clips the purpose and the failure text", () => {
            expect(purposeOf("x".repeat(80))).toHaveLength(60)
            expect(failureTextOf(new Error("e".repeat(300)))).toHaveLength(200)
            expect(failureTextOf("plain")).toBe("plain")
        })

        it("stores the prompt, the format and the deadline", () => {
            const stored = inputJsonOf(paramsOf({ responseFormat: "json" }), 9000)

            expect(stored).toBe(
                '{"messages":[{"role":"user","content":"hi"}],"response_format":"json","timeout_ms":9000}',
            )
        })
    })

    describe("inputOf", () => {
        it("reads a stored input back", () => {
            expect(
                inputOf({
                    messages: [{ role: "system", content: "s" }, { role: "robot", content: "x" }, 4],
                    response_format: "json",
                    timeout_ms: 7000,
                }),
            ).toEqual({ messages: [{ role: "system", content: "s" }], responseFormat: "json", timeoutMs: 7000 })
        })

        it("falls back to defaults for a missing or malformed input", () => {
            const fallback = { messages: [], responseFormat: "text", timeoutMs: DEFAULT_TIMEOUT_MS }

            expect(inputOf(null)).toEqual(fallback)
            expect(inputOf({ messages: "no", response_format: "xml", timeout_ms: "soon" })).toEqual(fallback)
        })
    })

    describe("usageOf and timingsOf", () => {
        it("reads a usage shape and refuses anything else", () => {
            expect(usageOf(USAGE)).toEqual(USAGE)
            expect(usageOf({ ...USAGE, model: 3 })).toEqual({ ...USAGE, model: null })
            expect(usageOf({ ...USAGE, cost: "free" })).toBeNull()
            expect(usageOf({ ...USAGE, prompt_tokens: "1" })).toBeNull()
            expect(usageOf({ ...USAGE, completion_tokens: null })).toBeNull()
            expect(usageOf({ ...USAGE, cached_tokens: undefined })).toBeNull()
            expect(usageOf("nope")).toBeNull()
        })

        it("keeps the numeric marks only", () => {
            expect(timingsOf({ total_ms: 5, note: "x", bad: Number.NaN })).toEqual({ total_ms: 5 })
            expect(timingsOf(null)).toEqual({})
        })
    })

    describe("progress and verdict", () => {
        it("maps a polled row", () => {
            const progress = progressOf({ status: "done", output: { text: "hello" }, usage: USAGE, timings: { a: 1 } })

            expect(progress).toEqual({ status: "done", text: "hello", usage: USAGE, timings: { a: 1 } })
            expect(progressOf({ status: "queued", output: null, usage: null, timings: {} }).text).toBeNull()
            expect(progressOf({ status: "done", output: { text: 3 }, usage: null, timings: {} }).text).toBeNull()
        })

        it("says done only with text, failed on error or cancel, and waiting otherwise", () => {
            const base = { usage: null, timings: {} }

            expect(verdictOf({ ...base, status: "done", text: "t" })).toEqual({
                kind: "done",
                text: "t",
                progress: { ...base, status: "done", text: "t" },
            })
            expect(verdictOf({ ...base, status: "done", text: null })).toBeNull()
            expect(verdictOf({ ...base, status: "error", text: null })).toEqual({ kind: "failed" })
            expect(verdictOf({ ...base, status: "cancelled", text: null })).toEqual({ kind: "failed" })
            expect(verdictOf({ ...base, status: "running", text: null })).toBeNull()
        })

        it("treats queued and running rows as waiting", () => {
            expect(isWaiting("queued")).toBe(true)
            expect(isWaiting("running")).toBe(true)
            expect(isWaiting("done")).toBe(false)
        })
    })

    describe("queuedOf", () => {
        it("maps a generation row", () => {
            const queued = queuedOf({
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

    describe("composeTurn", () => {
        const inputFor = builder<GenerationInput>({ messages: [], responseFormat: "text", timeoutMs: 1000 })

        it("puts the system prompt, the dialogue so far and the last line in order", () => {
            const text = composeTurn(
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

        it("handles an empty prompt", () => {
            expect(composeTurn(inputFor())).toBe(
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
})
