import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { THIS_MODEL_MESSAGE_VI } from "@tests/fixtures/i18n/ai-tasks-spec.messages"
import { AI } from "@modules/integrations/ai"
import { DomainError } from "@modules/platform/errors"
import type { AiChatModel, AiService } from "@modules/integrations/ai"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TIMER } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import {
    ANSWER,
    COMBO_ORDER,
    ITEMS_A_JSON,
    ITEMS_SCHEMA,
    USAGE,
    dataUrls,
} from "@tests/fixtures/builders/ai-tasks-service.builder"
import { AiTasksService } from "./ai-tasks.service"
import { NodeImagesService } from "./node-images.service"
import { NotesService } from "./notes.service"
import type { AiTaskScope } from "./ai-tasks.contracts"
import { AI_TASKS_METER, AI_TASKS_OPTIONS } from "./ai-tasks.decorators"
import type { AiTasksOptions } from "./ai-tasks.options"
import type { AiTaskMeter } from "./ai-tasks.port"
import { AiTasksError, AiTasksErrorCode } from "./errors/ai-tasks.error"


/** A spec-local stand-in for `@starci/ai-router`'s `RoutedModelsError`: a coded error of the shared `DomainError` base. */
class RouterCatalogError extends DomainError<"ROUTED_CATALOG_UNAVAILABLE"> {}
const scope: AiTaskScope = { workspaceId: "ws-1", locale: "vi" }

/** A chat-model double: the client a try is handed is only passed on to the loop, never called. */
const modelOf = (): AiChatModel => mock<AiChatModel>()

/** A try that failed at the provider: the loop reads it as a failed try of its own. */
const failedTry = (): AiTasksError => new AiTasksError({ code: AiTasksErrorCode.Unavailable })

/** What a spec scripts and reads back: the prompt the endpoint was sent, with the identity the call was metered under once it answered. */
interface Sent extends Pick<Parameters<AiService["chat"]>[0], "messages" | "json"> {
    workspaceId?: string
    kind?: string
    module?: string
}

const build = async (_unused = 1, available = true, limits: Partial<AiTasksOptions> = {}) => {
    const generator = { generate: jest.fn<Promise<string>, [Sent]>() }
    const ai = mock<AiService>()
    ai.available.mockReturnValue(available)
    // The loop's try is timed: the stopwatch of a spec reads 1.2 s.
    ai.stopwatch.mockReturnValue(() => 1_200)
    ai.attempt.mockImplementation(async (request) => {
        const answer = await ai.chat(request)
        return answer === null ? { ok: false, failure: "timeout" } : { ok: true, answer }
    })
    const sent: Array<Sent> = []
    ai.chat.mockImplementation(async ({ messages, json }) => {
        const prompt: Sent = { messages, json }
        sent.push(prompt)
        return { ...ANSWER, text: await generator.generate(prompt), usage: USAGE, model: "m" }
    })
    const meter = mock<AiTaskMeter>()
    const notes = mock<NotesService>()
    meter.blockedBy.mockResolvedValue(null)
    meter.record.mockImplementation(({ workspaceId, kind, module }) => {
        Object.assign(sent.at(-1) ?? {}, { workspaceId, kind, module })
        return Promise.resolve()
    })
    const logger = mock<Logger>()
    // The pause before a retry runs at once, and is recorded.
    const timer = mock<Timer>({
        schedule: jest.fn((callback: () => void) => {
            callback()
            return () => undefined
        }),
    })
    const images = mock<NodeImagesService>({ inline: jest.fn(dataUrls) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AiTasksService,
            { provide: AI_TASKS_OPTIONS, useValue: { timeoutMs: 30_000, ...limits } },
            { provide: AI, useValue: ai },
            { provide: AI_TASKS_METER, useValue: meter },
            { provide: NotesService, useValue: notes },
            { provide: NodeImagesService, useValue: images },
            { provide: LOGGER, useValue: logger },
            { provide: TIMER, useValue: timer },
        ],
    }).compile()
    return { client: moduleRef.get(AiTasksService), generator, ai, meter, notes, logger, images, timer }
}

/** A node's call as the specs make it: the order node reads the items of a message. */
const ORDER_ASK = { purpose: "order.record:extract", instructions: "Read the order", input: { text: "2 combo" } }

describe("AiTasksService node calls", () => {
    it("runs a graph node's text and JSON calls, metered under the node's namespace", async () => {
        const { client, generator } = await build()
        generator.generate.mockResolvedValueOnce("Hello").mockResolvedValueOnce('{"items":"2 combo"}')

        await expect(client.nodeText(scope, ORDER_ASK)).resolves.toBe("Hello")
        await expect(client.nodeJson(scope, { ...ORDER_ASK, input: undefined }, ITEMS_SCHEMA)).resolves.toEqual({
            items: "2 combo",
        })
        expect(generator.generate.mock.calls[0]?.[0]).toMatchObject({
            kind: "engine",
            module: "order",
            messages: [
                { role: "system", content: "Read the order" },
                { role: "user", content: '{"text":"2 combo"}' },
            ],
        })
        expect(generator.generate.mock.calls[1]?.[0].messages[1]?.content).toBe("null")
    })

    it("lets the scope override the usage kind and module", async () => {
        const { client, generator } = await build()
        generator.generate.mockResolvedValue("x")

        await client.nodeText({ ...scope, kind: "followup", module: "crm" }, ORDER_ASK)

        expect(generator.generate.mock.calls[0]?.[0]).toMatchObject({ kind: "followup", module: "crm" })
    })

    it("gives a node's call its own deadline and a bounded reasoning", async () => {
        const { client, ai } = await build(1, true, { nodeTimeoutMs: 90_000, nodeReasoning: "low" })
        ai.chat.mockResolvedValue({ ...ANSWER, text: '{"items":"x"}', usage: USAGE, model: "m" })
        const ask = { purpose: "sales.consult-turn:consult", instructions: "i", input: {} }

        await client.nodeJson(scope, ask, ITEMS_SCHEMA)
        await client.nodeText(scope, ask)

        expect(ai.chat.mock.calls[0]?.[0]).toMatchObject({ timeoutMs: 90_000, budget: { effort: "low" } })
        expect(ai.chat.mock.calls[1]?.[0]).toMatchObject({ timeoutMs: 90_000, budget: { effort: "low" } })
    })

    it("carries a node's pictures as bytes to the AI endpoint", async () => {
        const { client, ai, images } = await build(1, true)
        ai.chat.mockResolvedValue({ ...ANSWER, text: "ok", usage: USAGE, model: "m" })

        await client.nodeText(scope, { purpose: "intent.classify:x", instructions: "i", input: {}, images: ["u1"] })

        expect(images.inline).toHaveBeenCalledWith(["u1"], "ws-1")
        expect(ai.chat.mock.calls[0]?.[0].messages[1]).toMatchObject({ images: ["data:image/png;base64,u1"] })
    })

    it("LIVE IMG (D-MX-4): a picture it could not carry is told to the model as a fact of the input, never sent as seen", async () => {
        const { client, ai, images } = await build(1, true)
        ai.chat.mockResolvedValue({ ...ANSWER, text: "ok", usage: USAGE, model: "m" })
        images.inline.mockResolvedValueOnce({ images: [], dropped: 1 })

        await client.nodeText(scope, { purpose: "understand:x", instructions: "i", input: { message: THIS_MODEL_MESSAGE_VI }, images: [""] })

        const sent = JSON.stringify(ai.chat.mock.calls[0]?.[0].messages)
        expect(sent).toContain("picturesNotSeen")
        expect(sent).toContain("you have NOT seen them")
    })
})

describe("AiTasksService json parsing", () => {
    it("reads a fenced answer and an object inside prose", async () => {
        const { client, generator } = await build()
        generator.generate
            .mockResolvedValueOnce('```json\n{"items":"A"}\n```')
            .mockResolvedValueOnce('Here you go: {"items":"B"} enjoy')

        await expect(client.nodeJson(scope, ORDER_ASK, ITEMS_SCHEMA)).resolves.toMatchObject({ items: "A" })
        await expect(client.nodeJson(scope, ORDER_ASK, ITEMS_SCHEMA)).resolves.toMatchObject({ items: "B" })
    })

    it("asks again once when the model answered in prose, then reads the object", async () => {
        const { client, generator, logger } = await build()
        generator.generate.mockResolvedValueOnce("I think the items are A").mockResolvedValueOnce(ITEMS_A_JSON)

        await expect(client.nodeJson(scope, ORDER_ASK, ITEMS_SCHEMA)).resolves.toMatchObject({ items: "A" })

        expect(generator.generate).toHaveBeenCalledTimes(2)
        expect(generator.generate.mock.calls[1]?.[0].messages.at(-1)).toEqual({
            role: "system",
            content: "Answer again with ONLY the JSON object described above. No prose, no code fences.",
        })
        expect(logger.warn).toHaveBeenCalled()
    })

    it("treats a JSON value that is not an object as prose", async () => {
        const { client, generator } = await build()
        generator.generate.mockResolvedValueOnce("[1,2]").mockResolvedValueOnce(ITEMS_A_JSON)

        await expect(client.nodeJson(scope, ORDER_ASK, ITEMS_SCHEMA)).resolves.toMatchObject({ items: "A" })
    })

    it("fails with a typed error when the model never answers with JSON: three tries in all, each named", async () => {
        const { client, generator } = await build()
        generator.generate.mockResolvedValue("no json here")

        await expect(client.nodeJson(scope, ORDER_ASK, ITEMS_SCHEMA)).rejects.toMatchObject({
            code: AiTasksErrorCode.JsonNotReturned,
            params: { tries: 3, failures: "not_json, not_json, not_json" },
        })
        expect(generator.generate).toHaveBeenCalledTimes(3)
    })
})

describe("AiTasksService on the AI endpoint", () => {
    it("fails as unavailable without the AI endpoint: no other door, no quota read, no model call", async () => {
        const { client, ai, meter } = await build(1, false)

        await expect(client.nodeJson(scope, ORDER_ASK, ITEMS_SCHEMA)).rejects.toMatchObject({
            code: AiTasksErrorCode.Unavailable,
        })
        await expect(
            client.nodeText(scope, { purpose: "intent.classify:x", instructions: "i", input: {}, images: ["u1"] }),
        ).rejects.toMatchObject({ code: AiTasksErrorCode.Unavailable })

        expect(ai.chat).not.toHaveBeenCalled()
        expect(meter.blockedBy).not.toHaveBeenCalled()
    })

    it("runs the prompt on LangChain once a key is set, within the timeout, and meters the answer", async () => {
        const { client, generator, ai, meter } = await build(1, true)
        ai.chat.mockResolvedValue({ ...ANSWER, text: "- who", model: "work", usage: USAGE })

        await expect(client.nodeText(scope, ORDER_ASK)).resolves.toBe("- who")

        expect(generator.generate).not.toHaveBeenCalled()
        expect(meter.blockedBy).toHaveBeenCalledWith("ws-1", "engine", "vi")
        expect(ai.chat.mock.calls[0]?.[0]).toMatchObject({ json: false, timeoutMs: 30_000 })
        expect(ai.chat.mock.calls[0]?.[0].messages[1]?.content).toContain("2 combo")
        expect(meter.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "engine",
            module: "order",
            usage: {
                prompt_tokens: 12,
                completion_tokens: 5,
                cached_tokens: 0,
                cache_write_tokens: 0,
                cost: 0.0002,
                model: "work",
            },
            completionChars: 5,
            call: {
                purpose: "order.record:extract",
                reasoningTokens: null,
                durationMs: null,
                tryNumber: 1,
                upstream: null,
                finishReason: null,
            },
        })
    })
})


describe("AiTasksService on the AI endpoint, JSON and refusals", () => {
    it("asks LangChain for JSON on a JSON prompt and books unreported usage as zero", async () => {
        const { client, ai, meter } = await build(1, true)
        const none = { promptTokens: null, completionTokens: null, totalTokens: null, costUsd: null }
        ai.chat.mockResolvedValue({
            ...ANSWER,
            text: ITEMS_A_JSON,
            model: "work",
            usage: none,
        })

        await expect(client.nodeJson(scope, ORDER_ASK, ITEMS_SCHEMA)).resolves.toMatchObject({ items: "A" })

        expect(ai.chat.mock.calls[0]?.[0].json).toBe(true)
        expect(meter.record.mock.calls[0]?.[0].usage).toEqual({
            prompt_tokens: 0,
            completion_tokens: 0,
            cached_tokens: 0,
            cache_write_tokens: 0,
            cost: 0,
            model: "work",
        })
    })

    it("AI failure: fails twice then answers on the third try, with the same prompt and limits: two failed tries booked, one answer, nothing thrown", async () => {
        const { client, ai, meter, logger } = await build(1, true)
        ai.attempt
            .mockResolvedValueOnce({ ok: false, failure: "timeout" })
            .mockResolvedValueOnce({ ok: false, failure: "length" })
            .mockResolvedValueOnce({ ok: true, answer: { ...ANSWER, text: "thanks", model: "work", usage: USAGE } })

        await expect(client.nodeText(scope, ORDER_ASK)).resolves.toBe("thanks")

        expect(ai.attempt).toHaveBeenCalledTimes(3)
        // The retry after a timeout may take the name's next protocol (`fallback`); the retry after a cut answer keeps the first.
        expect(ai.attempt.mock.calls[1]?.[0]).toEqual({ ...ai.attempt.mock.calls[0]?.[0], fallback: true })
        expect(ai.attempt.mock.calls[2]?.[0]).toEqual(ai.attempt.mock.calls[0]?.[0])
        expect(ai.attempt.mock.calls[0]?.[0]).toMatchObject({ affinity: "ws-1" })
        expect(ai.attempt.mock.calls[0]?.[0]).not.toHaveProperty("fallback")
        expect(logger.warn).toHaveBeenCalledWith("ai_tasks.retried", {
            workspaceId: "ws-1",
            module: "order",
            tried: 1,
            failure: "timeout",
            again: true,
        })
        expect(meter.blockedBy).toHaveBeenCalledTimes(1)
        // Owner 2026-11-11: a failed try is booked too (estimated, the prompt the app sent, no output), then the answer.
        expect(
            meter.record.mock.calls.map(([entry]) => [entry.failure, entry.call?.tryNumber, entry.usage === null]),
        ).toEqual([
            ["timeout", 1, true],
            ["length", 2, true],
            [undefined, 3, false],
        ])
        expect(meter.record.mock.calls[0]?.[0]).toMatchObject({
            completionChars: 0,
            model: "work",
            kind: "engine",
            module: "order",
        })
        expect(meter.record.mock.calls[0]?.[0].promptChars).toBeGreaterThan(0)
    })
})

describe("AiTasksService on the AI endpoint, JSON and refusals: the tries", () => {
    it("AI failure: fails three times and stops, naming the tries made and what each failed as; never a fourth try, each failed try booked", async () => {
        const { client, ai, meter } = await build(1, true)
        ai.attempt
            .mockResolvedValueOnce({ ok: false, failure: "timeout" })
            .mockResolvedValueOnce({ ok: false, failure: "provider" })
            .mockResolvedValueOnce({ ok: false, failure: "empty" })

        await expect(client.nodeText(scope, ORDER_ASK)).rejects.toMatchObject({
            code: AiTasksErrorCode.Unavailable,
            params: { tries: 3, failures: "timeout, provider, empty" },
        })
        expect(ai.attempt).toHaveBeenCalledTimes(3)
        expect(meter.record.mock.calls.map(([entry]) => entry.failure)).toEqual(["timeout", "provider", "empty"])
    })

    it("gives a node call 90 s on its first try and 45 s on each retry (three minutes at worst)", async () => {
        const limits = {
            timeoutMs: 45_000,
            nodeTimeoutMs: 90_000,
            nodeRetryTimeoutMs: 45_000,
            nodeReasoning: "low" as const,
        }
        const { client, ai } = await build(1, true, limits)
        ai.attempt.mockResolvedValue({ ok: false, failure: "timeout" })
        const ask = { purpose: "sales.consult-turn:consult", instructions: "i", input: {} }

        await expect(client.nodeJson(scope, ask, ITEMS_SCHEMA)).rejects.toMatchObject({ params: { tries: 3 } })

        const deadlines = ai.attempt.mock.calls.map(([call]) => call.timeoutMs)
        expect(deadlines).toEqual([90_000, 45_000, 45_000])
        expect(deadlines.reduce((sum, ms) => sum + ms, 0)).toBe(180_000)
        // Every try of the node call keeps its bounded reasoning.
        expect(ai.attempt.mock.calls.every(([call]) => call.budget?.effort === "low")).toBe(true)
    })

    it("metering: books a node call under its purpose, with the try that answered, its hidden reasoning, upstream, finish and time", async () => {
        const { client, ai, meter } = await build(1, true)
        const served = { upstream: "Together", finishReason: "stop", durationMs: 6_500 }
        ai.attempt.mockResolvedValueOnce({ ok: false, failure: "timeout" }).mockResolvedValueOnce({
            ok: true,
            answer: {
                ...ANSWER,
                text: JSON.stringify(COMBO_ORDER),
                model: "work",
                usage: { ...USAGE, reasoningTokens: 2_475 },
                served,
            },
        })
        const ask = { purpose: "accounting.match-payment:agent", instructions: "i", input: {} }

        await client.nodeJson(scope, ask, ITEMS_SCHEMA)

        expect(meter.record).toHaveBeenCalledTimes(2)
        expect(meter.record.mock.calls[0]?.[0]).toMatchObject({
            failure: "timeout",
            call: { purpose: "accounting.match-payment:agent", tryNumber: 1 },
        })
        expect(meter.record.mock.calls[1]?.[0]).toMatchObject({
            kind: "engine",
            module: "accounting",
            call: { purpose: "accounting.match-payment:agent", reasoningTokens: 2_475, tryNumber: 2, ...served },
        })
    })
})

describe("AiTasksService on the AI endpoint, JSON and refusals: pause and allowance", () => {
    it("waits two seconds before it retries a provider error, and not at all after a timeout or once no try is left", async () => {
        const { client, ai, timer } = await build(1, true)
        ai.attempt
            .mockResolvedValueOnce({ ok: false, failure: "provider" })
            .mockResolvedValueOnce({ ok: false, failure: "timeout" })
            .mockResolvedValueOnce({ ok: false, failure: "provider" })

        await expect(client.nodeText(scope, ORDER_ASK)).rejects.toMatchObject({ params: { tries: 3 } })

        expect(timer.schedule.mock.calls.map(([, ms]) => ms)).toEqual([2000])
    })

    it("AI failure: an answer that is no JSON draws on the same three tries as a timeout, never on a count of its own", async () => {
        const { client, ai } = await build(1, true)
        const prose = { ok: true as const, answer: { ...ANSWER, text: "not json", model: "work", usage: USAGE } }
        ai.attempt
            .mockResolvedValueOnce({ ok: false, failure: "timeout" })
            .mockResolvedValueOnce(prose)
            .mockResolvedValueOnce(prose)

        await expect(
            client.nodeJson(scope, { purpose: "sales.consult:x", instructions: "i", input: {} }, ITEMS_SCHEMA),
        ).rejects.toMatchObject({
            code: AiTasksErrorCode.JsonNotReturned,
            params: { tries: 3, failures: "timeout, not_json, not_json" },
        })
        expect(ai.attempt).toHaveBeenCalledTimes(3)
    })

    it("refuses a workspace over its allowance before calling the endpoint", async () => {
        const { client, ai, meter } = await build(1, true)
        meter.blockedBy.mockResolvedValue({ message: "Over the allowance" })

        await expect(client.nodeText(scope, ORDER_ASK)).rejects.toMatchObject({
            code: AiTasksErrorCode.QuotaBlocked,
            params: { message: "Over the allowance" },
        })
        expect(ai.chat).not.toHaveBeenCalled()
    })
})

describe("AiTasksService structured output", () => {
    const reply = { ...ANSWER, text: "Hello", model: "work", usage: USAGE }

    it("hands a JSON call its schema and uses the structured output without parsing the text again", async () => {
        const { client, ai } = await build(1, true)
        ai.chat.mockResolvedValue({ ...reply, text: "not json", parsed: { items: "B" } })

        await expect(client.nodeJson(scope, ORDER_ASK, ITEMS_SCHEMA)).resolves.toMatchObject({ items: "B" })

        expect(ai.chat.mock.calls[0]?.[0].schema).not.toBeNull()
        expect(ai.chat).toHaveBeenCalledTimes(1)
    })

    it("falls back to the loose parse of the text when the answer did not fit the schema", async () => {
        const { client, ai } = await build(1, true)
        ai.chat.mockResolvedValue({ ...reply, text: 'Sure: {"items":"C"}' })

        await expect(client.nodeJson(scope, ORDER_ASK, ITEMS_SCHEMA)).resolves.toMatchObject({ items: "C" })
    })

    it("sends no schema and no notes with a text call", async () => {
        const { client, ai, notes } = await build(1, true)
        ai.chat.mockResolvedValue(reply)
        notes.contextOf.mockReturnValue(null)

        await client.nodeText(scope, ORDER_ASK)

        expect(ai.chat.mock.calls[0]?.[0]).toMatchObject({ schema: null, context: null })
        expect(notes.contextOf).toHaveBeenCalledWith(scope, null)
    })
})

const LOOP_ASK = { purpose: "accounting.match-payment:agent" }
const LOOP_LIMITS = {
    nodeTimeoutMs: 90_000,
    nodeRetryTimeoutMs: 45_000,
    nodeReasoning: "low" as const,
    nodeMaxTokens: 4000,
}
const LOOP_READ = {
    ok: true as const,
    model: "work",
    usage: { ...USAGE, cachedTokens: 8, reasoningTokens: 3 },
    textChars: 0,
    toolCalls: 1,
    served: { upstream: "Wafer", finishReason: "tool_calls", durationMs: 1_200 },
}

/** The loop's side of a turn: it makes the model call with the client it is given and answers the message. */
const loopOf = (outcomes: ReadonlyArray<unknown>) => {
    const left = [...outcomes]
    return jest.fn((_model: unknown, _tryNumber: number): Promise<unknown> => {
        const next = left.shift()
        return next instanceof DomainError ? Promise.reject(next) : Promise.resolve(next)
    })
}

describe("AiTasksService the turns of a node's agent loop", () => {
    it("hands the loop a fresh client per try and answers the message of the first try that is an answer: one metered answer", async () => {
        const { client, ai, meter } = await build(1, true, LOOP_LIMITS)
        const [first, second, third] = [modelOf(), modelOf(), modelOf()] as const
        ai.turnModel
            .mockResolvedValueOnce(first)
            .mockResolvedValueOnce(second)
            .mockResolvedValueOnce(third)
        ai.failureOfThrow.mockReturnValue("timeout")
        ai.readTurn.mockReturnValueOnce({ ok: false, failure: "length" }).mockReturnValueOnce(LOOP_READ)
        const attempt = loopOf([failedTry(), { cut: true }, { message: "third" }])

        const turns = client.nodeAgentTurns(scope, LOOP_ASK)
        await expect(turns.turn(attempt)).resolves.toEqual({ message: "third" })

        expect(turns.toolChoice).toBe("auto")
        expect(attempt.mock.calls).toEqual([
            [first, 1],
            [second, 2],
            [third, 3],
        ])
        // The first try has the node call's deadline, each retry the shorter one; every try the same reasoning, cap and affinity.
        expect(ai.turnModel.mock.calls.map(([request]) => request)).toEqual([
            { timeoutMs: 90_000, budget: { effort: "low", maxTokens: 4000 }, affinity: "ws-1" },
            // A retry after a timeout takes the name's next protocol when it has one (`fallback`); after a cut answer it does not.
            { timeoutMs: 45_000, budget: { effort: "low", maxTokens: 4000 }, affinity: "ws-1", fallback: true },
            { timeoutMs: 45_000, budget: { effort: "low", maxTokens: 4000 }, affinity: "ws-1" },
        ])
        expect(meter.blockedBy).toHaveBeenCalledTimes(1)
        expect(meter.blockedBy).toHaveBeenCalledWith("ws-1", "engine", "vi")
        // The two failed tries before the answer are booked first (estimated, no answer yet: no prompt known, so none counted).
        expect(meter.record.mock.calls.map(([entry]) => entry.failure)).toEqual([
            "timeout",
            "length",
            undefined,
        ])
        expect(meter.record).toHaveBeenLastCalledWith({
            workspaceId: "ws-1",
            kind: "engine",
            module: "accounting",
            usage: {
                prompt_tokens: 12,
                completion_tokens: 5,
                cached_tokens: 8,
                cache_write_tokens: 0,
                cost: 0.0002,
                model: "work",
            },
            completionChars: 0,
            // Metering per call kind: the node's purpose, the hidden reasoning, which try answered, the upstream and the time.
            call: {
                purpose: "accounting.match-payment:agent",
                reasoningTokens: 3,
                durationMs: 1_200,
                tryNumber: 3,
                upstream: "Wafer",
                finishReason: "tool_calls",
            },
        })
        // Each try that made a call was timed, and its time handed to the read of its answer.
        expect(ai.readTurn.mock.calls.map(([, , ms]) => ms)).toEqual([1_200, 1_200])
    })

})

describe("AiTasksService the turns of a node's agent loop: the tries", () => {
    it("stops after three tries in all and throws unavailable with the failure of each; each failed try is booked", async () => {
        const { client, ai, meter, timer } = await build(1, true, LOOP_LIMITS)
        ai.turnModel.mockResolvedValue(modelOf())
        ai.failureOfThrow.mockReturnValueOnce("provider").mockReturnValueOnce("timeout")
        ai.readTurn.mockReturnValue({ ok: false, failure: "empty" })
        const attempt = loopOf([failedTry(), failedTry(), { empty: true }, { never: true }])

        await expect(client.nodeAgentTurns(scope, LOOP_ASK).turn(attempt)).rejects.toMatchObject({
            code: AiTasksErrorCode.Unavailable,
            params: { tries: 3, failures: "provider, timeout, empty" },
        })

        expect(attempt).toHaveBeenCalledTimes(3)
        expect(meter.record.mock.calls.map(([entry]) => entry.failure)).toEqual(["provider", "timeout", "empty"])
        // Two seconds before the retry of the provider error only.
        expect(timer.schedule.mock.calls.map(([, ms]) => ms)).toEqual([2000])
    })

    it("takes a router failure to build the client as a failed try of its own and ends as unavailable, never carrying the router's error", async () => {
        const { client, ai } = await build(1, true, LOOP_LIMITS)
        // The router's own coded error (a DomainError of the shared base, as `@starci/ai-router` throws when its catalog cannot be read).
        const catalogDown = new RouterCatalogError({ code: "ROUTED_CATALOG_UNAVAILABLE" })
        ai.turnModel.mockRejectedValue(catalogDown)
        ai.failureOfThrow.mockReturnValue("provider")
        const attempt = loopOf([{ never: true }])

        const failed: unknown = await client
            .nodeAgentTurns(scope, LOOP_ASK)
            .turn(attempt)
            .then(
                () => null,
                (cause: unknown) => cause,
            )

        expect(failed).toMatchObject({ code: AiTasksErrorCode.Unavailable, params: { tries: 3, failures: "provider, provider, provider" } })
        // An infrastructure failure, never a business refusal: the lane's own error, with no router error under it.
        expect(failed).toBeInstanceOf(Error)
        expect(failed instanceof Error ? failed.cause : catalogDown).toBeUndefined()
        expect(ai.failureOfThrow.mock.calls.map(([cause]) => cause)).toEqual([catalogDown, catalogDown, catalogDown])
        expect(attempt).not.toHaveBeenCalled()
    })

})

describe("AiTasksService the turns of a node's agent loop: allowance", () => {
    it("refuses a workspace over its allowance before any model call, and fails as unavailable without the endpoint", async () => {
        const over = await build(1, true, LOOP_LIMITS)
        over.meter.blockedBy.mockResolvedValue({ message: "Over the plan" })
        const attempt = loopOf([{ message: "x" }])

        await expect(over.client.nodeAgentTurns(scope, LOOP_ASK).turn(attempt)).rejects.toMatchObject({
            code: AiTasksErrorCode.QuotaBlocked,
        })
        const off = await build(1, false, LOOP_LIMITS)
        await expect(off.client.nodeAgentTurns(scope, LOOP_ASK).turn(attempt)).rejects.toMatchObject({
            code: AiTasksErrorCode.Unavailable,
        })
        expect(attempt).not.toHaveBeenCalled()
        expect(over.ai.turnModel).not.toHaveBeenCalled()
    })
})

describe("AiTasksService the turns of a node's agent loop: pictures, client and tool choice", () => {
    it("inlines the pictures of a node's agent as the JSON call does, in order, and reads nothing for no pictures", async () => {
        const { client, images } = await build(1, true)

        await expect(client.nodeImages(scope, ["u1", "u2"])).resolves.toEqual([
            "data:image/png;base64,u1",
            "data:image/png;base64,u2",
        ])
        expect(images.inline).toHaveBeenCalledWith(["u1", "u2"], "ws-1")
        // What the inliner leaves out (unreadable, too large) is left out here too.
        images.inline.mockResolvedValueOnce({ images: ["data:image/png;base64,u2"], dropped: 1 })
        await expect(client.nodeImages(scope, ["bad", "u2"])).resolves.toEqual(["data:image/png;base64,u2"])
        images.inline.mockClear()
        await expect(client.nodeImages(scope, [])).resolves.toEqual([])
        expect(images.inline).not.toHaveBeenCalled()
    })

    it("hands the loop the client of a first try to build its agent over, built once and only when read, with the routing of node calls", async () => {
        const routed = { ...LOOP_LIMITS, nodeRouting: { order: ["together", "wafer"], allowFallbacks: true } }
        const { client, ai } = await build(1, true, routed)
        const first = modelOf()
        ai.turnModel.mockResolvedValue(first)

        const turns = client.nodeAgentTurns(scope, LOOP_ASK)
        expect(ai.turnModel).not.toHaveBeenCalled()

        await expect(turns.model).resolves.toBe(first)
        await expect(turns.model).resolves.toBe(first)
        expect(ai.turnModel).toHaveBeenCalledTimes(1)
        expect(ai.turnModel.mock.calls[0]?.[0]).toEqual({
            timeoutMs: 90_000,
            budget: { effort: "low", maxTokens: 4000 },
            affinity: "ws-1",
            routing: { order: ["together", "wafer"], allowFallbacks: true },
        })
        // No routing set: the client carries none, so no `provider` field is sent.
        const plain = await build(1, true, LOOP_LIMITS)
        plain.ai.turnModel.mockResolvedValue(first)
        void plain.client.nodeAgentTurns(scope, LOOP_ASK).model
        expect(plain.ai.turnModel.mock.calls[0]?.[0]).not.toHaveProperty("routing")
        // No endpoint configured: no client to build over.
        const off = await build(1, false, LOOP_LIMITS)
        off.ai.turnModel.mockResolvedValue(null)
        await expect(off.client.nodeAgentTurns(scope, LOOP_ASK).model).resolves.toBeUndefined()
    })

    it("never forces a tool call on the endpoint's profile (Claude only), and sends the step's own reasoning", async () => {
        const { client, ai } = await build(1, true, LOOP_LIMITS)
        ai.turnModel.mockResolvedValue(modelOf())
        ai.readTurn.mockReturnValue(LOOP_READ)

        const off = client.nodeAgentTurns(scope, { ...LOOP_ASK, reasoning: "off" })
        await off.turn(loopOf([{ message: "x" }]))

        expect(off.toolChoice).toBe("auto")
        expect(ai.turnModel.mock.calls[0]?.[0]).toMatchObject({ budget: { effort: "off", maxTokens: 4000 } })
        expect(client.nodeAgentTurns(scope, { ...LOOP_ASK, reasoning: "medium" }).toolChoice).toBe("auto")
    })
})

const MODEL_ASK = { purpose: "accounting.match-payment:agent", instructions: "i", input: {} }
const MODEL_BOTH = { providers: { anthropic: true, openrouter: false } }
const MODEL_NO_KEY = { providers: { anthropic: false, openrouter: false } }
const MODEL_SONNET = "claude-sonnet-5-5"
const MODEL_HAIKU = "claude-haiku-5-5"
const MODEL_DEEPSEEK = "deepseek/deepseek-v4.1-flash"
const modelAnswered = (model: string) => ({
    ok: true as const,
    answer: { ...ANSWER, text: JSON.stringify(COMBO_ORDER), model, usage: USAGE },
})
const modelTargetsOf = (ai: Awaited<ReturnType<typeof build>>["ai"]) =>
    ai.attempt.mock.calls.map(([request]) => request.target?.name ?? null)

describe("AiTasksService the model of a node's call (model per node, Auto by rule)", () => {
    it("key absent: the default fails loudly before any call (it no longer becomes DeepSeek: no other vendor)", async () => {
        const { client, ai } = await build(1, true, MODEL_NO_KEY)

        await expect(
            client.nodeJson(
                { ...scope, model: { model: MODEL_SONNET, weight: "heavy", source: "default" } },
                MODEL_ASK,
                ITEMS_SCHEMA,
            ),
        ).rejects.toMatchObject({
            code: AiTasksErrorCode.Unavailable,
            params: { tries: 0, failures: `model_not_configured:${MODEL_SONNET}` },
        })
        expect(ai.attempt).not.toHaveBeenCalled()
    })

    it("a stored node naming the retired DeepSeek runs on Haiku's tier and the metering says retired-model", async () => {
        const { client, ai, meter } = await build(1, true, MODEL_BOTH)
        ai.attempt.mockResolvedValueOnce(modelAnswered(MODEL_HAIKU))

        await client.nodeJson(
            { ...scope, model: { model: MODEL_DEEPSEEK, weight: "heavy", source: "node" } },
            MODEL_ASK,
            ITEMS_SCHEMA,
        )

        expect(modelTargetsOf(ai)).toEqual(["auto-light"])
        expect(meter.record.mock.calls[0]?.[0].call).toMatchObject({
            declaredModel: MODEL_DEEPSEEK,
            modelProvider: "anthropic",
            modelReason: "retired-model",
        })
    })

    it("key present: the default is Sonnet, sent without a temperature or the upstream's own fields", async () => {
        const { client, ai, meter } = await build(1, true, MODEL_BOTH)
        ai.attempt.mockResolvedValueOnce(modelAnswered(MODEL_SONNET))

        await client.nodeJson(
            { ...scope, model: { model: MODEL_SONNET, weight: "light", source: "default" } },
            MODEL_ASK,
            ITEMS_SCHEMA,
        )

        expect(ai.attempt.mock.calls[0]?.[0].target).toEqual({
            name: "sonnet",
            sampling: false,
            forcedToolChoice: false,
            upstreamFields: false,
        })
        expect(meter.record.mock.calls[0]?.[0]).toMatchObject({
            usage: { model: MODEL_SONNET },
            call: { declaredModel: MODEL_SONNET, modelProvider: "anthropic", modelReason: "default" },
        })
    })
})

describe("AiTasksService the model of a node's call: explicit models and Auto", () => {
    it("an explicit model whose provider is down fails loudly after three tries, every try on that model, never switching", async () => {
        const { client, ai, meter } = await build(1, true, MODEL_BOTH)
        ai.attempt.mockResolvedValue({ ok: false, failure: "provider" })

        await expect(
            client.nodeJson({ ...scope, model: { model: MODEL_SONNET, weight: "light", source: "node" } }, MODEL_ASK, ITEMS_SCHEMA),
        ).rejects.toMatchObject({ code: AiTasksErrorCode.Unavailable, params: { tries: 3 } })

        expect(modelTargetsOf(ai)).toEqual(["sonnet", "sonnet", "sonnet"])
        // Each failed try is booked on the model it asked for, estimated, never billed.
        expect(
            meter.record.mock.calls.map(([entry]) => [entry.failure, entry.model, entry.call?.declaredModel]),
        ).toEqual([
            ["provider", MODEL_SONNET, MODEL_SONNET],
            ["provider", MODEL_SONNET, MODEL_SONNET],
            ["provider", MODEL_SONNET, MODEL_SONNET],
        ])
    })

    it("an explicit model with no key fails loudly before any call", async () => {
        const { client, ai } = await build(1, true, MODEL_NO_KEY)

        await expect(
            client.nodeText({ ...scope, model: { model: MODEL_SONNET, weight: "light", source: "node" } }, MODEL_ASK),
        ).rejects.toMatchObject({
            code: AiTasksErrorCode.Unavailable,
            params: { tries: 0, failures: `model_not_configured:${MODEL_SONNET}` },
        })

        expect(ai.attempt).not.toHaveBeenCalled()
    })

})

describe("AiTasksService the model of a node's call: Auto", () => {
    it("Auto: a light step asks Haiku and steps up to Sonnet after a failed try; a heavy step asks Sonnet first", async () => {
        const light = await build(1, true, MODEL_BOTH)
        light.ai.attempt
            .mockResolvedValueOnce({ ok: false, failure: "timeout" })
            .mockResolvedValueOnce(modelAnswered(MODEL_SONNET))

        await light.client.nodeJson(
            { ...scope, model: { model: "auto", weight: "light", source: "declared" } },
            MODEL_ASK,
            ITEMS_SCHEMA,
        )

        expect(modelTargetsOf(light.ai)).toEqual(["auto-light", "auto-heavy"])
        expect(light.meter.record.mock.calls[0]?.[0]).toMatchObject({
            failure: "timeout",
            call: { tryNumber: 1, modelReason: "auto-light" },
        })
        expect(light.meter.record.mock.calls[1]?.[0].call).toMatchObject({ tryNumber: 2, modelReason: "auto-step-up" })

        const heavy = await build(1, true, MODEL_BOTH)
        heavy.ai.attempt.mockResolvedValueOnce(modelAnswered(MODEL_HAIKU))

        await heavy.client.nodeJson(
            { ...scope, model: { model: "auto", weight: "heavy", source: "declared" } },
            MODEL_ASK,
            ITEMS_SCHEMA,
        )

        expect(modelTargetsOf(heavy.ai)).toEqual(["auto-heavy"])
        // The router served Haiku on Auto's heavy profile: Sonnet had no usable lane (Claude only, never another vendor).
        expect(heavy.meter.record.mock.calls[0]?.[0].call).toMatchObject({
            modelProvider: "anthropic",
            modelReason: "auto-failover",
        })
    })

    it("a call that names no model goes to the endpoint's chat profile", async () => {
        const { client, ai, meter } = await build(1, true, MODEL_BOTH)
        ai.attempt.mockResolvedValueOnce({
            ok: true,
            answer: { ...ANSWER, text: "- who", model: "work", usage: USAGE },
        })

        await client.nodeText(scope, MODEL_ASK)

        expect(ai.attempt.mock.calls[0]?.[0]).not.toHaveProperty("target")
        expect(meter.record.mock.calls[0]?.[0].call).not.toHaveProperty("modelReason")
    })
})

describe("AiTasksService the model of a node's call: one loop and Claude", () => {
    it("level 2: every turn of one step's agent loop gets the model of its first answer (the cache is per model)", async () => {
        const { client, ai, meter } = await build(1, true, { ...MODEL_BOTH, nodeReasoning: "off" })
        ai.turnModel.mockResolvedValue(modelOf())
        ai.failureOfThrow.mockReturnValue("timeout")
        const read = (model: string) => ({ ok: true as const, model, usage: USAGE, textChars: 0, toolCalls: 1 })
        ai.readTurn
            .mockReturnValueOnce(read(MODEL_SONNET))
            .mockReturnValueOnce(read(MODEL_SONNET))
            .mockReturnValueOnce(read(MODEL_SONNET))
        const attempt = jest
            .fn<Promise<unknown>, [unknown, number]>()
            .mockRejectedValueOnce(new Error("deadline"))
            .mockResolvedValue({ message: "turn" })
        const turns = client.nodeAgentTurns(
            { ...scope, model: { model: "auto", weight: "light", source: "declared" } },
            { purpose: MODEL_ASK.purpose },
        )

        // An Auto step may land on Sonnet, which refuses a forced tool call: the step's tool choice stays free.
        expect(turns.toolChoice).toBe("auto")
        await turns.turn(attempt)
        await turns.turn(attempt)
        await turns.turn(attempt)

        // Turn 1: the cheap model fails, Auto steps up to Sonnet; turns 2 and 3 stay on Sonnet's own profile.
        expect(ai.turnModel.mock.calls.map(([request]) => request.target?.name)).toEqual([
            "auto-light",
            "auto-heavy",
            "sonnet",
            "sonnet",
        ])
        expect(meter.record.mock.calls.map(([entry]) => entry.call?.modelReason)).toEqual([
            "auto-light",
            "auto-step-up",
            "step-pinned",
            "step-pinned",
        ])
    })

    it("level 2: every step is on Claude now, so no step forces a tool call (Claude 5.5 refuses it), even without reasoning", async () => {
        const { client } = await build(1, true, { ...MODEL_BOTH, nodeReasoning: "off" })

        for (const model of [MODEL_HAIKU, MODEL_DEEPSEEK]) {
            const turns = client.nodeAgentTurns(
                { ...scope, model: { model, weight: "light", source: "declared" } },
                { purpose: MODEL_ASK.purpose },
            )
            expect(turns.toolChoice).toBe("auto")
        }
    })
})
