import { Test } from "@nestjs/testing"
import { builder, FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AiService } from "./ai.service"
import type { AiChatRequest, AiRunner } from "./ai.contracts"
import { AI_OPTIONS, AI_RUNNER } from "./ai.decorators"
import { AiLogEvent } from "./ai.log-events"
import type { AiOptions } from "./ai.options"

const defaults: AiOptions = {
    gatewayUrl: "http://localhost:3212/v1",
    virtualKey: new Secret("sk-starci-test"),
    chatModel: "work",
    embeddingModel: "embed",
}

const build = async (keyed: boolean, overrides: Partial<AiOptions> = {}) => {
    const options = builder<AiOptions>(defaults)(overrides)
    const runner = mock<AiRunner>()
    const logger = mock<Logger>()
    const clock = new FakeClock("2026-11-10T12:00:00.000Z")
    const moduleRef = keyed
        ? await Test.createTestingModule({
              providers: [
                  AiService,
                  { provide: AI_OPTIONS, useValue: options },
                  { provide: AI_RUNNER, useValue: runner },
                  { provide: LOGGER, useValue: logger },
                  { provide: CLOCK, useValue: clock },
              ],
          }).compile()
        : await Test.createTestingModule({
              providers: [
                  AiService,
                  { provide: AI_OPTIONS, useValue: options },
                  { provide: AI_RUNNER, useValue: null },
                  { provide: LOGGER, useValue: logger },
                  { provide: CLOCK, useValue: clock },
              ],
          }).compile()
    return { client: moduleRef.get(AiService), runner, logger, clock }
}

const MODEL = "deepseek/deepseek-v4.1-flash"
const ASK: AiChatRequest = {
    messages: [{ role: "user", content: "hi" }],
    json: false,
    schema: null,
    timeoutMs: 1000,
    context: null,
}

const reply = (content: unknown, extra: Record<string, unknown> = {}) => ({
    content,
    parsed: null,
    usageMetadata: undefined,
    responseMetadata: { model_name: MODEL },
    retrieved: 0,
    ...extra,
})

describe("AiService without a key", () => {
    it("reports AI unavailable and answers null without a call", async () => {
        const { client } = await build(false)

        expect(client.available()).toBe(false)
        expect(client.chatModel()).toBe("work")
        // The old profile name is not a known identity: its vectors never equal `text-embedding-3-small@1536`.
        expect(client.embeddingModel()).toBe("profile:embed")
        await expect(client.chat(ASK)).resolves.toBeNull()
        await expect(client.embed({ input: ["a"], dimensions: 4, timeoutMs: 1000 })).resolves.toBeNull()
    })

    it("logs a missing virtual key once at boot and does not throw", async () => {
        const { client, logger } = await build(false, { virtualKey: null })

        expect(() => client.onModuleInit()).not.toThrow()
        expect(logger.warn).toHaveBeenCalledWith(AiLogEvent.VirtualKeyMissing, {
            gatewayUrl: "http://localhost:3212/v1",
        })
    })

    it("stays quiet with a key, or with no base URL at all", async () => {
        const keyed = await build(true)
        const nowhere = await build(false, { gatewayUrl: null, virtualKey: null })

        keyed.client.onModuleInit()
        nowhere.client.onModuleInit()

        expect(keyed.logger.warn).not.toHaveBeenCalled()
        expect(nowhere.logger.warn).not.toHaveBeenCalled()
    })
})

describe("AiService chat", () => {
    it("runs the chain and reads text, model and usage from the message metadata", async () => {
        const { client, runner } = await build(true)
        runner.chat.mockResolvedValue(
            reply("  hello  ", {
                usageMetadata: { input_tokens: 12, output_tokens: 5, total_tokens: 17, input_token_details: { cache_read: 8 } },
                responseMetadata: { model_name: MODEL, usage: { cost: 0.0002 } },
                retrieved: 2,
            }),
        )

        await expect(client.chat(ASK)).resolves.toEqual({
            text: "hello",
            parsed: null,
            model: MODEL,
            usage: { promptTokens: 12, completionTokens: 5, totalTokens: 17, costUsd: 0.0002, cachedTokens: 8, reasoningTokens: null },
            retrieved: 2,
            served: { upstream: null, finishReason: null, durationMs: 0 },
        })
        expect(runner.chat.mock.calls[0]?.[0]).toMatchObject({ messages: ASK.messages, json: false, timeoutMs: 1000 })
    })

    it("prompt cache: logs what a call's cache hit depends on (upstream, cached tokens, a digest of the opening system text), never the prompt", async () => {
        const { client, runner, logger } = await build(true)
        runner.chat.mockResolvedValue(
            reply("ok", {
                provider: "DeepInfra",
                usageMetadata: { input_tokens: 50, output_tokens: 5, total_tokens: 55, input_token_details: { cache_read: 40 } },
            }),
        )
        const head = { role: "system" as const, content: "CRAFT AND TOOLS" }

        await client.chat({ ...ASK, messages: [head, { role: "user", content: "first thread" }] })
        await client.chat({ ...ASK, messages: [head, { role: "user", content: "another thread" }] })

        const [first, second] = logger.info.mock.calls.filter(([event]) => event === "ai.chat.answered")
        expect(first?.[1]).toMatchObject({
            provider: "DeepInfra",
            prompt: 50,
            cached: 40,
            messages: 2,
            headChars: 15,
        })
        expect(second?.[1]).toMatchObject({ headDigest: first?.[1]?.headDigest, openingDigest: first?.[1]?.openingDigest })
        expect(JSON.stringify(logger.info.mock.calls)).not.toContain("thread")
        expect(JSON.stringify(logger.info.mock.calls)).not.toContain("CRAFT")
    })

    it("returns the structured output when the chain parsed one, and none when it did not", async () => {
        const { client, runner } = await build(true)
        runner.chat.mockResolvedValueOnce(reply("{}", { parsed: { stage: "new" } })).mockResolvedValueOnce(reply("{}"))

        await expect(client.chat({ ...ASK, json: true })).resolves.toMatchObject({ parsed: { stage: "new" } })
        await expect(client.chat({ ...ASK, json: true })).resolves.toMatchObject({ parsed: null })
    })

    it("reads the token usage of the response metadata and the text blocks of a list content", async () => {
        const { client, runner } = await build(true)
        runner.chat.mockResolvedValue(
            reply([{ type: "text", text: "a" }, { type: "image" }, { text: "b" }], {
                responseMetadata: { tokenUsage: { promptTokens: 3, completionTokens: 1, totalTokens: 4 } },
            }),
        )

        await expect(client.chat(ASK)).resolves.toEqual(
            expect.objectContaining({
                text: "ab",
                model: "work",
                usage: { promptTokens: 3, completionTokens: 1, totalTokens: 4, costUsd: null, cachedTokens: null, reasoningTokens: null },
            }),
        )
    })

    it.each([
        ["OpenRouter's prompt_tokens_details", { prompt_tokens_details: { cached_tokens: 40 } }],
        ["DeepSeek's prompt_cache_hit_tokens", { prompt_cache_hit_tokens: 40 }],
    ])("prompt cache: reads the cached prompt tokens from the raw usage (%s)", async (_name, usage) => {
        const { client, runner } = await build(true)
        runner.chat.mockResolvedValue(
            reply("ok", {
                usageMetadata: { input_tokens: 50, output_tokens: 5, total_tokens: 55 },
                responseMetadata: { usage },
            }),
        )

        await expect(client.chat(ASK)).resolves.toMatchObject({ usage: { promptTokens: 50, cachedTokens: 40 } })
    })

    it("reads the hidden reasoning of an answer from the usage, by either name, and logs it beside the answer's size", async () => {
        const { client, runner, logger } = await build(true)
        runner.chat
            .mockResolvedValueOnce(
                reply("ok", {
                    usageMetadata: { input_tokens: 50, output_tokens: 900, total_tokens: 950, output_token_details: { reasoning: 870 } },
                }),
            )
            .mockResolvedValueOnce(
                reply("ok", {
                    usageMetadata: { input_tokens: 50, output_tokens: 900, total_tokens: 950 },
                    responseMetadata: { usage: { completion_tokens_details: { reasoning_tokens: 860 } } },
                }),
            )

        await expect(client.chat({ ...ASK, budget: { effort: "low", maxTokens: 4000 } })).resolves.toMatchObject({
            usage: { completionTokens: 900, reasoningTokens: 870 },
        })
        await expect(client.chat(ASK)).resolves.toMatchObject({ usage: { reasoningTokens: 860 } })
        expect(logger.info).toHaveBeenCalledWith(
            "ai.chat.answered",
            expect.objectContaining({ completion: 900, reasoning: 870, answerChars: 2, effort: "low", cap: 4000 }),
        )
    })

    it("reads the message of an agent turn: what it used and how many tools it called, or the failure it is", async () => {
        const { client, logger } = await build(true)
        const request = { timeoutMs: 90_000, budget: { effort: "low" as const, maxTokens: 4000 } }
        const turn = {
            content: "",
            tool_calls: [{ name: "payment.order.settle", args: { orderId: "o-1" }, id: "call_1" }],
            usage_metadata: {
                input_tokens: 8000,
                output_tokens: 60,
                total_tokens: 8060,
                input_token_details: { cache_read: 7424 },
                output_token_details: { reasoning: 18 },
            },
            response_metadata: { model_name: MODEL, finish_reason: "tool_calls" },
            additional_kwargs: { __raw_response: { provider: "Relace" } },
        }

        expect(client.readTurn(turn, request)).toEqual({
            ok: true,
            model: MODEL,
            usage: {
                promptTokens: 8000,
                completionTokens: 60,
                totalTokens: 8060,
                costUsd: null,
                cachedTokens: 7424,
                reasoningTokens: 18,
            },
            textChars: 0,
            toolCalls: 1,
            served: { upstream: "Relace", finishReason: "tool_calls", durationMs: null },
        })
        expect(logger.info).toHaveBeenCalledWith(
            "ai.chat.answered",
            expect.objectContaining({ provider: "Relace", prompt: 8000, cached: 7424, reasoning: 18, toolCalls: 1, agentTurn: true }),
        )
        expect(JSON.stringify(logger.info.mock.calls)).not.toContain("o-1")
        // The routing the try asked for is logged beside the upstream that served it; null when it asked for none.
        expect(logger.info.mock.calls.at(-1)?.[1]).toMatchObject({ routing: null })
        client.readTurn(turn, { ...request, routing: { order: ["relace", "wafer"], allowFallbacks: true } })
        expect(logger.info.mock.calls.at(-1)?.[1]).toMatchObject({
            provider: "Relace",
            routing: { order: ["relace", "wafer"], allow_fallbacks: true },
        })
        // A turn cut at the token limit, and a turn with neither words nor a tool call, are failures of the AI.
        expect(client.readTurn({ ...turn, response_metadata: { finish_reason: "length" } }, request)).toEqual({
            ok: false,
            failure: "length",
        })
        expect(client.readTurn({ content: "  ", tool_calls: [] }, request)).toEqual({ ok: false, failure: "empty" })
        expect(client.readTurn({ content: "Dạ", tool_calls: [] }, request)).toMatchObject({ ok: true, textChars: 2, toolCalls: 0 })
    })

    it("metering: says which upstream served a call, why the model stopped and how long the try took", async () => {
        const { client, runner, logger, clock } = await build(true)
        runner.chat.mockImplementation(() => {
            clock.advance(4_250)
            return Promise.resolve(
                reply("{}", { provider: "Parasail", responseMetadata: { model_name: MODEL, finish_reason: "stop" } }),
            )
        })

        await expect(client.attempt({ ...ASK, json: true })).resolves.toMatchObject({
            ok: true,
            answer: { served: { upstream: "Parasail", finishReason: "stop", durationMs: 4_250 } },
        })
        expect(logger.info).toHaveBeenCalledWith(
            "ai.chat.answered",
            expect.objectContaining({ provider: "Parasail", finish: "stop", ms: 4_250 }),
        )
    })

    it("metering: a stopwatch reads the whole milliseconds since it started, and a timed agent turn carries its time", async () => {
        const { client, clock } = await build(true)
        const elapsed = client.stopwatch()
        clock.advance(1_500)
        const took = elapsed()
        const turn = { content: "ok", response_metadata: { finish_reason: "stop" } }

        expect(took).toBe(1_500)
        expect(client.readTurn(turn, { timeoutMs: 90_000 }, took)).toMatchObject({
            ok: true,
            served: { upstream: null, finishReason: "stop", durationMs: 1_500 },
        })
    })

    it("gives the loop a client per try only when the endpoint is configured, and names what a call that threw failed as", async () => {
        const { client, runner } = await build(true)
        const model = { made: true }
        runner.turnModel.mockResolvedValue(model as never)
        const request = { timeoutMs: 45_000, affinity: "ws-1" }

        await expect(client.turnModel(request)).resolves.toBe(model)
        expect(runner.turnModel).toHaveBeenCalledWith(request)
        await expect((await build(false)).client.turnModel(request)).resolves.toBeNull()
        expect(client.failureOfThrow(Object.assign(new Error("x"), { name: "TimeoutError" }))).toBe("timeout")
        expect(client.failureOfThrow(Object.assign(new Error("x"), { name: "AbortError" }))).toBe("timeout")
        expect(client.failureOfThrow(Object.assign(new Error("x"), { status: 502 }))).toBe("provider")
    })

    it("says why a try gave no answer: the deadline, a cut answer, an empty one, the provider, no endpoint", async () => {
        const { client, runner, logger } = await build(true)
        const timeout = Object.assign(new Error("deadline"), { name: "TimeoutError" })
        runner.chat
            .mockRejectedValueOnce(timeout)
            .mockResolvedValueOnce(reply('{"half": "an obj', { responseMetadata: { finish_reason: "length" } }))
            .mockResolvedValueOnce(reply("   "))
            .mockRejectedValueOnce(Object.assign(new Error("bad gateway"), { status: 502 }))
            .mockResolvedValueOnce(reply("ok"))

        await expect(client.attempt(ASK)).resolves.toEqual({ ok: false, failure: "timeout" })
        await expect(client.attempt(ASK)).resolves.toEqual({ ok: false, failure: "length" })
        await expect(client.attempt(ASK)).resolves.toEqual({ ok: false, failure: "empty" })
        await expect(client.attempt(ASK)).resolves.toEqual({ ok: false, failure: "provider" })
        await expect(client.attempt(ASK)).resolves.toMatchObject({ ok: true, answer: { text: "ok" } })
        expect(logger.warn).toHaveBeenCalledWith("ai.chat.cut", expect.objectContaining({ answerChars: 16 }))

        const off = await build(false)
        await expect(off.client.attempt(ASK)).resolves.toEqual({ ok: false, failure: "unconfigured" })
    })

    it("answers null and logs when the answer is empty", async () => {
        const { client, runner, logger } = await build(true)
        runner.chat
            .mockResolvedValueOnce(reply("   "))
            .mockResolvedValueOnce(reply(undefined, { responseMetadata: {} }))

        await expect(client.chat(ASK)).resolves.toBeNull()
        await expect(client.chat(ASK)).resolves.toBeNull()
        expect(logger.warn).toHaveBeenCalledWith(AiLogEvent.ChatEmpty, { model: MODEL })
        expect(logger.warn).toHaveBeenCalledWith(AiLogEvent.ChatEmpty, { model: "work" })
    })

    it("answers null and logs the class and status, never the message, when the call fails", async () => {
        const { client, runner, logger } = await build(true)
        runner.chat.mockRejectedValueOnce(Object.assign(new Error("secret prompt"), { status: 429 }))
        runner.chat.mockRejectedValueOnce("down")

        await expect(client.chat(ASK)).resolves.toBeNull()
        await expect(client.chat(ASK)).resolves.toBeNull()
        expect(logger.warn).toHaveBeenCalledWith(AiLogEvent.ChatFailed, { errorClass: "Error", status: 429 })
        expect(logger.warn).toHaveBeenCalledWith(AiLogEvent.ChatFailed, { errorClass: "unknown", status: null })
    })
})

describe("AiService retrieval", () => {
    const passage = { title: "Hours", content: "Open 8 to 21" }

    it("hands the chain the domain search as it is when it works", async () => {
        const { client, runner } = await build(true)
        const search = jest.fn().mockResolvedValue([passage])
        runner.chat.mockResolvedValue(reply("ok"))

        await client.chat({ ...ASK, context: { question: "hours?", limit: 3, search } })
        const context = runner.chat.mock.calls[0]?.[0].context

        expect(context).toMatchObject({ question: "hours?", limit: 3 })
        await expect(context?.search("hours?")).resolves.toEqual([passage])
    })

    it("never fails the call for a search that fails: no notes, and the failure is logged", async () => {
        const { client, runner, logger } = await build(true)
        const search = jest.fn().mockRejectedValue(new Error("db down"))
        runner.chat.mockResolvedValue(reply("ok"))

        await expect(client.chat({ ...ASK, context: { question: "q", limit: 3, search } })).resolves.not.toBeNull()
        const context = runner.chat.mock.calls[0]?.[0].context

        await expect(context?.search("q")).resolves.toEqual([])
        expect(logger.warn).toHaveBeenCalledWith(AiLogEvent.RetrievalFailed, {
            errorClass: "Error",
            status: null,
        })
    })

    it("fails loudly when the gateway does not serve embeddings (no OpenAI key): logged, null, and remembered as not served", async () => {
        const { client, runner, logger } = await build(true)
        runner.embed.mockRejectedValueOnce(Object.assign(new Error("transient"), { status: 502 }))

        await expect(client.embed({ input: ["a"], dimensions: 1, timeoutMs: 1 })).resolves.toBeNull()
        // A transient failure is retried later: embeddings stay served.
        expect(client.embeddingsServed()).toBe(true)

        runner.embed.mockRejectedValueOnce(Object.assign(new Error("model_not_allowed"), { status: 403 }))
        await expect(client.embed({ input: ["a"], dimensions: 1, timeoutMs: 1 })).resolves.toBeNull()

        expect(logger.warn).toHaveBeenLastCalledWith(AiLogEvent.EmbeddingFailed, { errorClass: "Error", status: 403 })
        expect(client.embeddingsServed()).toBe(false)
    })
})

describe("AiService embedding identity", () => {
    it("records and compares vectors by the model identity of the profile, never the profile name", async () => {
        const { client } = await build(true, { embeddingModel: "embed-oa" })

        expect(client.embeddingModel()).toBe("text-embedding-3-small@1536")
    })
})

describe("AiService embed", () => {
    it("embeds the clipped texts and returns the vectors in order, with no usage (LangChain reports none)", async () => {
        const { client, runner } = await build(true)
        runner.embed.mockResolvedValue([[1, 2], "AAAA"])

        const long = "x".repeat(9000)
        await expect(client.embed({ input: [long, "b"], dimensions: 2, timeoutMs: 5000 })).resolves.toEqual({
            vectors: [[1, 2], []],
            usage: null,
        })
        expect(runner.embed).toHaveBeenCalledWith({ input: ["x".repeat(8000), "b"], dimensions: 2, timeoutMs: 5000 })
    })

    it("answers no vectors when the answer is not a list, and null on no input or a failure", async () => {
        const { client, runner, logger } = await build(true)
        runner.embed.mockResolvedValueOnce({})

        await expect(client.embed({ input: ["a"], dimensions: 1, timeoutMs: 1 })).resolves.toMatchObject({
            vectors: [],
        })
        await expect(client.embed({ input: [], dimensions: 1, timeoutMs: 1 })).resolves.toBeNull()
        runner.embed.mockRejectedValueOnce(new Error("down"))
        await expect(client.embed({ input: ["a"], dimensions: 1, timeoutMs: 1 })).resolves.toBeNull()
        expect(logger.warn).toHaveBeenCalledWith(AiLogEvent.EmbeddingFailed, {
            errorClass: "Error",
            status: null,
        })
    })

    it("fails loudly when the gateway does not serve embeddings (no OpenAI key): logged, null, and remembered as not served", async () => {
        const { client, runner, logger } = await build(true)
        runner.embed.mockRejectedValueOnce(Object.assign(new Error("transient"), { status: 502 }))

        await expect(client.embed({ input: ["a"], dimensions: 1, timeoutMs: 1 })).resolves.toBeNull()
        // A transient failure is retried later: embeddings stay served.
        expect(client.embeddingsServed()).toBe(true)

        runner.embed.mockRejectedValueOnce(Object.assign(new Error("model_not_allowed"), { status: 403 }))
        await expect(client.embed({ input: ["a"], dimensions: 1, timeoutMs: 1 })).resolves.toBeNull()

        expect(logger.warn).toHaveBeenLastCalledWith(AiLogEvent.EmbeddingFailed, { errorClass: "Error", status: 403 })
        expect(client.embeddingsServed()).toBe(false)
    })
})
