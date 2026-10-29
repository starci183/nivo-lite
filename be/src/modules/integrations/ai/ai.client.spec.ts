import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
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

describe("AiClient chat", () => {
    it("calls the gateway profile with the virtual key at temperature 0 within the deadline and reads the message metadata", async () => {
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
        expect(sent.text).toContain('"temperature":0')
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
