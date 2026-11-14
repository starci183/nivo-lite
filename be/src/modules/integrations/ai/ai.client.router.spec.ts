import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { gatewayAnswering, gatewayAnthropicMessage, gatewayCompletion, gatewayJsonBodyOf, gatewayPostsOf, gatewaySentOf, gatewayVectors } from "@tests/fixtures/builders/ai.builder"
import { AiClient } from "./ai.client"
import type { AiChatRequest } from "./ai.contracts"
import { AI_ENDPOINT_OPTIONS } from "./ai.decorators"
import type { AiEndpoint } from "./ai.options"
import { ANY_OBJECT } from "./ai.schema"

/** The client over a fake gateway: a chat call answers `content`, an embeddings call two vectors. */
const build = async (content = "hello") => {
    const endpoint = builder<AiEndpoint>({
        gatewayUrl: "http://gateway.test/v1",
        virtualKey: new Secret("sk-starci-test"),
        chatModel: "work",
        embeddingModel: "embed",
    })()
    const http = mock<HttpClient>()
    gatewayAnswering(
        http,
        (url) => {
            if (url.endsWith("/embeddings")) return gatewayVectors(2)
            return url.endsWith("/messages") ? gatewayAnthropicMessage(content) : gatewayCompletion(content)
        },
        { "content-type": "application/json" },
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            AiClient,
            { provide: AI_ENDPOINT_OPTIONS, useValue: endpoint },
            { provide: HTTP_CLIENT, useValue: http },
        ],
    }).compile()
    return { client: moduleRef.get(AiClient), http }
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

/** A target served through Anthropic: the profile the router 0.7.0 specs call by. */
const CLAUDE = { name: "claude", sampling: true, forcedToolChoice: false, upstreamFields: true }

describe("AiClient over the router 0.7.0: the protocol the gateway serves a name through", () => {
    it("reads the catalog once and asks a name served through Anthropic on the Messages route, under the same virtual key", async () => {
        const { client, http } = await build()

        const reply = await client.chat({ ...ASK, target: CLAUDE, budget: { effort: "low", maxTokens: 900 }, affinity: "ws-1" })
        await client.chat({ ...ASK, target: CLAUDE })

        expect(http.request.mock.calls.filter(([request]) => request.method === "GET")).toHaveLength(1)
        const sent = gatewaySentOf(http, 0)
        expect(sent.url).toBe("http://gateway.test/v1/messages")
        expect(sent.headers).toMatchObject({ "x-ai-router-kind": "anthropic" })
        // The one virtual key, in whichever header the Anthropic client sends it (the gateway takes `x-api-key` or a bearer token).
        expect(Object.values(sent.headers).some((value) => value.includes("sk-starci-test"))).toBe(true)
        const body = gatewayJsonBodyOf(sent.text)
        expect(body).toMatchObject({ model: "claude", max_tokens: 900 })
        // The `openai` kind's own fields never reach the other protocol: no temperature, no OpenRouter field.
        for (const field of ["temperature", "reasoning", "session_id", "provider", "modelKwargs"]) expect(body).not.toHaveProperty(field)
        expect(reply).toMatchObject({
            content: "hello",
            usageMetadata: { input_tokens: 18, output_tokens: 2, input_token_details: { cache_read: 5, cache_creation: 3 } },
        })
    })

    it("marks the prompt cache on anthropic: the automatic breakpoint and a marked layer end, the text unchanged", async () => {
        const { client, http } = await build()

        await client.chat({
            ...ASK,
            target: CLAUDE,
            messages: [
                { role: "system", content: "CRAFT TOOLS SHOP STEP", cacheMark: true },
                { role: "system", content: "this call only" },
                { role: "user", content: "{}" },
            ],
        })

        const body = gatewayJsonBodyOf(gatewaySentOf(http, 0).text)
        expect(body.cache_control).toEqual({ type: "ephemeral" })
        expect(body.system).toEqual([
            { type: "text", text: "CRAFT TOOLS SHOP STEP", cache_control: { type: "ephemeral" } },
            { type: "text", text: "this call only" },
        ])
    })

    it("a marked USER message ends a cacheable layer of data on anthropic: its text carries the breakpoint, the message after it none", async () => {
        const { client, http } = await build()

        await client.chat({
            ...ASK,
            target: CLAUDE,
            messages: [
                { role: "system", content: "STANDING INSTRUCTIONS", cacheMark: true },
                { role: "user", content: "THE DOCUMENT", cacheMark: true },
                { role: "user", content: "this call only" },
            ],
        })

        const sent = gatewaySentOf(http, 0).text
        expect(sent).toContain('{"type":"text","text":"STANDING INSTRUCTIONS","cache_control":{"type":"ephemeral"}}')
        expect(sent).toContain('{"type":"text","text":"THE DOCUMENT","cache_control":{"type":"ephemeral"}}')
        expect(sent.indexOf("THE DOCUMENT")).toBeLessThan(sent.indexOf("this call only"))
        expect(sent).not.toContain('"text":"this call only","cache_control"')
    })

})

describe("AiClient over the router 0.7.0: the JSON route and the retry of a protocol", () => {
    it("marks nothing on openai: the same marked prompt goes as plain text with no breakpoint anywhere", async () => {
        const { client, http } = await build()

        await client.chat({ ...ASK, messages: [{ role: "system", content: "STABLE", cacheMark: true }, { role: "user", content: "q" }] })

        expect(gatewaySentOf(http, 0).url).toBe("http://gateway.test/v1/chat/completions")
        expect(gatewaySentOf(http, 0).text).not.toContain("cache_control")
        expect(gatewaySentOf(http, 0).text).toContain('"content":"STABLE"')
    })

    it("parses a JSON answer of the Messages route from its text (no JSON mode there) and ends the prompt with the JSON line", async () => {
        const { client, http } = await build('```json\n{"stage":"new"}\n```')

        const reply = await client.chat({ ...ASK, target: CLAUDE, json: true, schema: ANY_OBJECT })

        expect(reply.parsed).toEqual({ stage: "new" })
        expect(gatewaySentOf(http, 0).text).toContain("Answer with one JSON object only")
        expect(gatewaySentOf(http, 0).text).not.toContain("response_format")
    })

    it("asks JSON mode on the OpenAI route for a JSON call", async () => {
        const { client, http } = await build('{"a":1}')

        await client.chat({ ...ASK, json: true })

        expect(gatewaySentOf(http, 0).text).toContain('"response_format":{"type":"json_object"}')
    })

    it("takes the name's next protocol on a retry after a provider failure, and the first one otherwise", async () => {
        const { client, http } = await build()

        await client.chat({ ...ASK, target: { ...CLAUDE, name: "both" } })
        await client.chat({ ...ASK, target: { ...CLAUDE, name: "both" }, fallback: true })
        await client.chat({ ...ASK, target: CLAUDE, fallback: true })

        expect(gatewayPostsOf(http).map((request) => request.url)).toEqual([
            "http://gateway.test/v1/messages",
            "http://gateway.test/v1/chat/completions",
            "http://gateway.test/v1/messages",
        ])
    })

    it("fails loudly when the gateway does not serve the name (no Anthropic key: no chat profile is declared)", async () => {
        const { client } = await build()

        await expect(client.chat({ ...ASK, target: { ...CLAUDE, name: "haiku" } })).rejects.toMatchObject({ code: "ROUTED_NAME_UNKNOWN" })
    })
})
