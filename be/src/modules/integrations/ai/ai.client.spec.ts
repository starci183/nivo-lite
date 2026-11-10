import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { parseJsonText } from "@modules/platform/primitives"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { AiClient } from "./ai.client"
import type { AiChatRequest } from "./ai.contracts"
import { AI_ENDPOINT_OPTIONS } from "./ai.decorators"
import type { AiEndpoint } from "./ai.options"
import { ANY_OBJECT } from "./ai.schema"

const completion = (content: string): string =>
    JSON.stringify({
        id: "chatcmpl-1",
        object: "chat.completion",
        created: 1,
        model: "fake-model",
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
        usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
    })

const vectors = (count: number): string =>
    JSON.stringify({
        object: "list",
        model: "fake-embed",
        data: Array.from({ length: count }, (_, index) => ({ object: "embedding", index, embedding: [index, 1] })),
        usage: { prompt_tokens: count, total_tokens: count },
    })

/** The client over a fake gateway: a chat call answers `content`, an embeddings call two vectors. */
const build = async (content = "hello") => {
    const endpoint = builder<AiEndpoint>({
        gatewayUrl: "http://gateway.test/v1",
        virtualKey: new Secret("sk-starci-test"),
        chatModel: "work",
        embeddingModel: "embed",
    })()
    const http = mock<HttpClient>()
    http.request.mockImplementation((request) => {
        const body = request.url.endsWith("/embeddings") ? vectors(2) : completion(content)
        return Promise.resolve({ status: 200, headers: { "content-type": "application/json" }, body })
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AiClient,
            { provide: AI_ENDPOINT_OPTIONS, useValue: endpoint },
            { provide: HTTP_CLIENT, useValue: http },
        ],
    }).compile()
    return { client: moduleRef.get(AiClient), http }
}

/** What the n-th call of the client sent to the gateway; the body as text. */
const sentOf = (http: ReturnType<typeof mock<HttpClient>>, at: number) => {
    const request = http.request.mock.calls[at]?.[0]
    return {
        url: request?.url ?? "",
        timeoutMs: request?.timeoutMs ?? 0,
        headers: request?.headers ?? {},
        text: request?.bytes?.toString("utf8") ?? "",
    }
}

const ASK: AiChatRequest = {
    messages: [
        { role: "system", content: "You are Mai." },
        { role: "user", content: "hi" },
    ],
    json: false,
    schema: null,
    timeoutMs: 5000,
    context: null,
}

/**
 * A target an OpenAI-compatible upstream could serve (no profile of the pool is one since 2026-11-11: every chat profile is Claude).
 * The mechanics of the upstream's own fields are kept and proven on it, so they work again the day such a profile returns.
 */
const UPSTREAM_TARGET = { name: "upstream-profile", sampling: true, forcedToolChoice: true, upstreamFields: true }
const ASK_UP: AiChatRequest = { ...ASK, target: UPSTREAM_TARGET }

const registerMultimodalChatCase = () => {
    it("sends the user's text and ordered image URLs together as one multimodal message", async () => {
        const { client, http } = await build()
        await expect(
            client.chat({
                ...ASK,
                messages: [
                    {
                        role: "user",
                        content: "Describe these",
                        images: ["https://images.test/a.png", "https://images.test/b.png"],
                    },
                ],
            }),
        ).resolves.toMatchObject({ content: "hello" })
        const read = parseJsonText(sentOf(http, 0).text)
        assert.ok(read.ok, "AI request body was not valid JSON")
        const sent = read.value
        expect(sent).toMatchObject({
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Describe these" },
                        { type: "image_url", image_url: { url: "https://images.test/a.png" } },
                        { type: "image_url", image_url: { url: "https://images.test/b.png" } },
                    ],
                },
            ],
        })
    })
}

describe("AiClient chat", () => {
    registerMultimodalChatCase()

    it("calls the gateway profile with the virtual key, no temperature (Claude only), within the deadline, and reads the message metadata", async () => {
        const { client, http } = await build()

        const reply = await client.chat(ASK)

        expect(reply).toMatchObject({
            content: "hello",
            parsed: null,
            retrieved: 0,
            usageMetadata: { input_tokens: 3, output_tokens: 2, total_tokens: 5 },
        })
        const sent = sentOf(http, 0)
        expect(sent).toMatchObject({ url: "http://gateway.test/v1/chat/completions", timeoutMs: 5000 })
        expect(sent.headers).toMatchObject({ authorization: "Bearer sk-starci-test" })
        expect(sent.text).toContain('"model":"work"')
        expect(sent.text).not.toContain('"temperature"')
        expect(sent.text).not.toContain("response_format")
    })

    it("parses a JSON answer into the structured output and keeps the raw message for usage", async () => {
        const { client } = await build('{"stage":"new"}')

        const reply = await client.chat({ ...ASK, json: true, schema: ANY_OBJECT })

        expect(reply.parsed).toEqual({ stage: "new" })
        expect(reply.usageMetadata).toMatchObject({ total_tokens: 5 })
    })

    it("parses a JSON answer into any object when the task names no schema", async () => {
        const { client } = await build('{"a":1}')

        await expect(client.chat({ ...ASK, json: true })).resolves.toMatchObject({ parsed: { a: 1 } })
    })

    it("answers no parsed object when the model's answer is not JSON", async () => {
        const { client } = await build("not json")

        await expect(client.chat({ ...ASK, json: true })).resolves.toMatchObject({ content: "not json", parsed: null })
    })

    it("puts the retrieved passages in the system message as business notes, cut to the limit, and counts them", async () => {
        const { client, http } = await build()
        const search = jest.fn().mockResolvedValue([
            { title: "Hours", content: "Open 8 to 21" },
            { title: null, content: "Free parking" },
            { title: "Cut", content: "beyond the limit" },
        ])

        const reply = await client.chat({ ...ASK, context: { question: "hours?", limit: 2, search } })

        expect(search).toHaveBeenCalledWith("hours?")
        expect(reply.retrieved).toBe(2)
        const sent = sentOf(http, 0).text
        expect(sent).toContain("Business notes")
        expect(sent).toContain("Hours: Open 8 to 21")
        expect(sent).not.toContain("beyond the limit")
    })

    it("sends the prompt untouched on an empty brain", async () => {
        const { client, http } = await build()
        const search = jest.fn().mockResolvedValue([])

        const reply = await client.chat({ ...ASK, context: { question: "q", limit: 4, search } })

        expect(reply.retrieved).toBe(0)
        expect(sentOf(http, 0).text).not.toContain("Business notes")
    })

    it("sends each role as its own message", async () => {
        const { client, http } = await build()

        await client.chat({ ...ASK, messages: [...ASK.messages, { role: "assistant", content: "ok" }] })

        expect(sentOf(http, 0).text).toMatch(/system.*user.*assistant/su)
    })
})

describe("AiClient prompt cache", () => {
    it("sends the same session_id for the same affinity, a digest and never the name, and none without one", async () => {
        const { client, http } = await build()

        await client.chat({ ...ASK_UP, affinity: "workspace-1" })
        await client.chat({ ...ASK_UP, affinity: "workspace-1", messages: [{ role: "user", content: "another" }] })
        await client.chat({ ...ASK_UP, affinity: "workspace-2" })
        await client.chat(ASK_UP)

        const sessions = [0, 1, 2].map((at) => /"session_id":"([0-9a-f]{32})"/u.exec(sentOf(http, at).text)?.[1])
        expect(sessions[0]).toBeDefined()
        expect(sessions[1]).toBe(sessions[0])
        expect(sessions[2]).not.toBe(sessions[0])
        expect(sentOf(http, 0).text).not.toContain("workspace-1")
        expect(sentOf(http, 3).text).not.toContain("session_id")
    })

    it("reads the upstream that served the call from the raw answer", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({
            status: 200,
            headers: { "content-type": "application/json" },
            body: completion("ok").replace('"object"', '"provider":"DeepInfra","object"'),
        })

        await expect(client.chat(ASK_UP)).resolves.toMatchObject({ provider: "DeepInfra" })
    })
})

describe("AiClient upstream routing", () => {
    it("sends no provider field for a call without a routing, or with a routing that names nothing", async () => {
        const { client, http } = await build()

        await client.chat({ ...ASK_UP, affinity: "workspace-1", budget: { effort: "low" } })
        await client.chat({ ...ASK_UP, routing: {} })
        await client.chat({ ...ASK_UP, routing: { order: [], only: [] } })
        await client.turnModel({ timeoutMs: 45_000 }).invoke([{ role: "user", content: "STEP" }])

        for (const at of [0, 1, 2, 3]) expect(sentOf(http, at).text).not.toContain('"provider"')
    })

    it("sends the routing as OpenRouter's provider object, only the fields it names, beside the reasoning and the session", async () => {
        const { client, http } = await build()

        await client.chat({
            ...ASK_UP,
            affinity: "workspace-1",
            budget: { effort: "low" },
            routing: { order: ["wafer", "together"], allowFallbacks: true },
        })
        await client.chat({ ...ASK_UP, routing: { sort: "throughput" } })
        await client.chat({ ...ASK_UP, routing: { only: ["wafer", "digitalocean"], allowFallbacks: false } })
        await client
            .turnModel({ timeoutMs: 45_000, routing: { order: ["together", "wafer"] }, target: UPSTREAM_TARGET })
            .invoke([{ role: "user", content: "STEP" }])

        const sent = [0, 1, 2, 3].map((at) => {
            const read = parseJsonText(sentOf(http, at).text)
            assert.ok(read.ok, "AI request body was not valid JSON")
            return read.value
        })
        expect(sent[0]).toMatchObject({
            provider: { order: ["wafer", "together"], allow_fallbacks: true },
            reasoning: { effort: "low", exclude: true },
        })
        expect(sentOf(http, 0).text).toMatch(/"session_id":"[0-9a-f]{32}"/u)
        expect(sent[1]).toMatchObject({ provider: { sort: "throughput" } })
        expect(sentOf(http, 1).text).toContain('"provider":{"sort":"throughput"}')
        expect(sentOf(http, 2).text).toContain('"provider":{"only":["wafer","digitalocean"],"allow_fallbacks":false}')
        expect(sentOf(http, 3).text).toContain('"provider":{"order":["together","wafer"]}')
    })
})

describe("AiClient the client of one try of an agent turn", () => {
    it("carries the try's limits and lets the loop bind its own tools: one request, no retry, the tools and the choice on the wire", async () => {
        const { client, http } = await build()
        const model = client.turnModel({
            timeoutMs: 45_000,
            budget: { effort: "low", maxTokens: 4000 },
            affinity: "workspace-1",
            target: UPSTREAM_TARGET,
        })
        const tools = [
            {
                type: "function" as const,
                function: {
                    name: "payment.order.settle",
                    description: "Mark the order paid.",
                    parameters: { type: "object", properties: { orderId: { type: "string" } }, required: ["orderId"] },
                },
            },
        ]

        const answer = await model.bindTools?.(tools, { tool_choice: "auto" }).invoke([
            { role: "system", content: "CRAFT" },
            { role: "user", content: "STEP" },
        ])

        expect(http.request).toHaveBeenCalledTimes(1)
        expect(http.request.mock.calls[0]?.[0]).toMatchObject({ timeoutMs: 45_000 })
        const sent = sentOf(http, 0).text
        expect(sent).toContain('"name":"payment.order.settle"')
        expect(sent).toContain('"tool_choice":"auto"')
        expect(sent).toContain('"reasoning":{"effort":"low","exclude":true}')
        expect(sent).toContain('"max_tokens":4000')
        expect(sent).toMatch(/"session_id":"[0-9a-f]{32}"/u)
        expect(sent).toContain('"temperature":0')
        // The message comes back untouched: the usage and the raw answer the tries read are on it.
        expect(answer?.usage_metadata).toMatchObject({ input_tokens: 3, output_tokens: 2 })
        expect(answer?.additional_kwargs?.__raw_response).toBeDefined()
    })
})

describe("AiClient chat budget", () => {
    it("sends a call without a budget with no token cap and no reasoning field", async () => {
        const { client, http } = await build()

        await client.chat(ASK_UP)

        const sent = sentOf(http, 0)
        expect(sent.text).not.toContain("max_tokens")
        expect(sent.text).not.toContain("reasoning")
    })

    it("sends the budget of a call as the most tokens it may write and reasoning switched off", async () => {
        const { client, http } = await build()

        await client.chat({ ...ASK_UP, budget: { effort: "off", maxTokens: 800 } })

        const sent = sentOf(http, 0)
        expect(sent.text).toContain('"max_tokens":800')
        expect(sent.text).toContain('"reasoning":{"enabled":false}')
    })

    it("sends a reasoning effort when the budget names one, with the output limit it is a share of, and never asks the reasoning text back", async () => {
        const { client, http } = await build()

        await client.chat({ ...ASK_UP, budget: { effort: "low", maxTokens: 800 } })
        await client.chat({ ...ASK_UP, budget: { effort: "minimal" } })

        expect(sentOf(http, 0).text).toContain('"reasoning":{"effort":"low","exclude":true}')
        expect(sentOf(http, 0).text).toContain('"max_tokens":800')
        expect(sentOf(http, 1).text).toContain('"reasoning":{"effort":"minimal","exclude":true}')
        expect(sentOf(http, 1).text).not.toContain("max_tokens")
    })

    it("sends a direct cap on reasoning in place of the effort when the budget names one, and none with reasoning off", async () => {
        const { client, http } = await build()

        await client.chat({ ...ASK_UP, budget: { effort: "low", reasoningMaxTokens: 1024 } })
        await client.chat({ ...ASK_UP, budget: { effort: "off", reasoningMaxTokens: 1024 } })

        expect(sentOf(http, 0).text).toContain('"reasoning":{"max_tokens":1024,"exclude":true}')
        expect(sentOf(http, 0).text).not.toContain('"effort"')
        expect(sentOf(http, 1).text).toContain('"reasoning":{"enabled":false}')
    })
})

describe("AiClient embed", () => {
    it("asks the embed profile for the size within the deadline and answers one vector per text", async () => {
        const { client, http } = await build()

        await expect(client.embed({ input: ["a", "b"], dimensions: 2, timeoutMs: 4000 })).resolves.toEqual([
            [0, 1],
            [1, 1],
        ])
        expect(sentOf(http, 0)).toMatchObject({ timeoutMs: 4000 })
        expect(sentOf(http, 0).text).toContain('"model":"embed"')
        expect(sentOf(http, 0).text).toContain('"dimensions":2')
    })
})

describe("AiClient gateway fetch", () => {
    it("posts a URL or request target with its headers and string body, and returns the text answer", async () => {
        const { client, http } = await build()
        const fetcher = client["fetcher"](3000)

        const fromUrl = await fetcher(new URL("http://gateway.test/v1/a"), { headers: { "x-a": "1" }, body: "payload" })
        const fromRequest = await fetcher(new Request("http://gateway.test/v1/b", { method: "POST" }))

        expect(await fromUrl.text()).toBe(completion("hello"))
        expect(fromRequest.status).toBe(200)
        expect(sentOf(http, 0)).toMatchObject({ url: "http://gateway.test/v1/a", timeoutMs: 3000, text: "payload" })
        expect(sentOf(http, 0).headers).toEqual({ "x-a": "1" })
        expect(sentOf(http, 1)).toMatchObject({ url: "http://gateway.test/v1/b", text: "" })
    })

    it("reads a non-text body as empty and a missing header set as none", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: new Uint8Array([1]) })

        const answer = await client["fetcher"](1000)("http://gateway.test/v1/c", { body: new Uint8Array([1]) })

        expect(answer.status).toBe(200)
        expect(await answer.text()).toBe("")
        expect(sentOf(http, 0).text).toBe("")
    })
})

describe("AiClient chat, the model a call targets", () => {
    const BUDGET = { effort: "low" as const, maxTokens: 4000 }

    it("asks the gateway for the target's profile with the body every provider it can reach accepts", async () => {
        const { client, http } = await build()

        await client.chat({
            ...ASK,
            budget: BUDGET,
            affinity: "ws-1",
            routing: { order: ["together"] },
            target: { name: "sonnet", sampling: false, forcedToolChoice: false, upstreamFields: false },
        })

        const sent = JSON.parse(sentOf(http, 0).text) as Record<string, unknown>
        expect(sent.model).toBe("sonnet")
        expect(sent.max_tokens).toBe(4000)
        for (const field of ["temperature", "reasoning", "session_id", "provider"]) expect(sent).not.toHaveProperty(field)
    })

    it("keeps the upstream's own fields for a profile an OpenAI-compatible upstream can serve, without a temperature when another cannot", async () => {
        const { client, http } = await build()

        await client.chat({
            ...ASK,
            budget: BUDGET,
            affinity: "ws-1",
            target: { name: "auto-light", sampling: false, forcedToolChoice: false, upstreamFields: true },
        })

        const sent = JSON.parse(sentOf(http, 0).text) as Record<string, unknown>
        expect(sent.model).toBe("auto-light")
        expect(sent).not.toHaveProperty("temperature")
        expect(sent).toMatchObject({ reasoning: { effort: "low", exclude: true } })
        expect(sent).toHaveProperty("session_id")
    })

    it("sends the Claude body when the call names no target (`work` is Claude only): no temperature, no OpenRouter fields", async () => {
        const { client, http } = await build()

        await client.chat({ ...ASK, budget: BUDGET, affinity: "ws-1", routing: { order: ["together"] } })

        const sent = JSON.parse(sentOf(http, 0).text) as Record<string, unknown>
        expect(sent).toMatchObject({ model: "work", max_tokens: 4000 })
        for (const field of ["temperature", "reasoning", "session_id", "provider"]) expect(sent).not.toHaveProperty(field)
    })

    it("sends a marked message as plain text while breakpoints are off the wire", async () => {
        const { client, http } = await build()

        await client.chat({ ...ASK, messages: [{ role: "system", content: "stable", cacheMark: true }, ASK.messages[1]!] })

        const sent = JSON.parse(sentOf(http, 0).text) as { messages: ReadonlyArray<{ content: unknown }> }
        expect(sent.messages[0]?.content).toBe("stable")
    })
})
