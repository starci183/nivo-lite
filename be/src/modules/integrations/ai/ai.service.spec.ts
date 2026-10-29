import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
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
    const moduleRef = keyed
        ? await Test.createTestingModule({
              providers: [
                  AiService,
                  { provide: AI_OPTIONS, useValue: options },
                  { provide: AI_RUNNER, useValue: runner },
                  { provide: LOGGER, useValue: logger },
              ],
          }).compile()
        : await Test.createTestingModule({
              providers: [
                  AiService,
                  { provide: AI_OPTIONS, useValue: options },
                  { provide: AI_RUNNER, useValue: null },
                  { provide: LOGGER, useValue: logger },
              ],
          }).compile()
    return { client: moduleRef.get(AiService), runner, logger }
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
        expect(client.embeddingModel()).toBe("embed")
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
                usageMetadata: { input_tokens: 12, output_tokens: 5, total_tokens: 17 },
                responseMetadata: { model_name: MODEL, usage: { cost: 0.0002 } },
                retrieved: 2,
            }),
        )

        await expect(client.chat(ASK)).resolves.toEqual({
            text: "hello",
            parsed: null,
            model: MODEL,
            usage: { promptTokens: 12, completionTokens: 5, totalTokens: 17, costUsd: 0.0002 },
            retrieved: 2,
        })
        expect(runner.chat.mock.calls[0]?.[0]).toMatchObject({ messages: ASK.messages, json: false, timeoutMs: 1000 })
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
                usage: { promptTokens: 3, completionTokens: 1, totalTokens: 4, costUsd: null },
            }),
        )
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
})
