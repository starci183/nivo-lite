import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { jsonTextOf } from "@tests/fixtures/builders/json-text.builder"
import { Secret } from "@modules/platform/config"
import { HTTP_CLIENT, type HttpClient } from "@modules/platform/http"
import { AiClient, structuredFieldsOf } from "./ai.client"
import type { AiBudget, AiChatRequest, AiOutputSchema } from "./ai.contracts"
import { AI_ENDPOINT_OPTIONS } from "./ai.decorators"
import type { AiEndpoint } from "./ai.options"

// A call's structured output reaches Anthropic as `output_config.format` beside its effort (claude-api skill, TypeScript reference:
// `output_config: { format: { type: "json_schema", schema } }`; installed `@anthropic-ai/sdk` 1.8.0 `OutputConfig.format:
// JSONOutputFormat`; `@langchain/anthropic` 1.6.2 merges its `outputConfig` into the body's `output_config`; the in-process gateway
// `@starci/ai-router` 0.7.0 forwards a Messages body untouched but for the model id). Proven on the BUILT body the client sends
// (a fake HTTP port: no network, no model).

const NAMES = ["work", "haiku", "sonnet"]
const ROUTES = {
    work: [{ model: "claude-haiku-5-5", profile: "haiku" }, { model: "claude-sonnet-5-5", profile: "sonnet" }],
    haiku: [{ model: "claude-haiku-5-5", profile: "haiku" }],
    sonnet: [{ model: "claude-sonnet-5-5", profile: "sonnet" }],
}

/** A schema of the shape the brain sends: every object closed, no length or number bound. */
const SCHEMA: AiOutputSchema = {
    type: "object",
    properties: { rule: { type: "array", items: { type: "integer" } } },
    required: ["rule"],
    additionalProperties: false,
}

const gateway = (): ReturnType<typeof mock<HttpClient>> => {
    const http = mock<HttpClient>()
    http.request.mockImplementation((request) =>
        Promise.resolve(
            request.method === "GET"
                ? {
                      status: 200,
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                          object: "list",
                          data: NAMES.map((id) => ({ object: "model", id, kinds: ["anthropic"], serves: ["chat"] })),
                      }),
                  }
                : {
                      status: 200,
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                          id: "msg_1",
                          type: "message",
                          role: "assistant",
                          model: "claude-sonnet-5-5",
                          content: [{ type: "text", text: '{"rule":[1]}' }],
                          stop_reason: "end_turn",
                          stop_sequence: null,
                          usage: { input_tokens: 10, output_tokens: 6 },
                      }),
                  },
        ),
    )
    return http
}

const bodyOf = async (budget: AiBudget | undefined, outputSchema: AiOutputSchema | undefined): Promise<Readonly<Record<string, unknown>>> => {
    const http = gateway()
    const endpoint = builder<AiEndpoint>({
        gatewayUrl: "http://gateway.test/v1",
        virtualKey: new Secret("sk-starci-test"),
        chatModel: "work",
        embeddingModel: "embed",
        profileRoutes: ROUTES,
    })()
    const moduleRef = await Test.createTestingModule({
        providers: [AiClient, { provide: AI_ENDPOINT_OPTIONS, useValue: endpoint }, { provide: HTTP_CLIENT, useValue: http }],
    }).compile()
    const request: AiChatRequest = {
        messages: [{ role: "user", content: "Which passages state a rule?" }],
        json: false,
        schema: null,
        timeoutMs: 5000,
        context: null,
        target: { name: "sonnet", sampling: false, forcedToolChoice: false, upstreamFields: false },
        ...(budget === undefined ? {} : { budget }),
        ...(outputSchema === undefined ? {} : { outputSchema }),
    }
    await moduleRef.get(AiClient).chat(request)
    const [sent] = http.request.mock.calls.map(([one]) => one).filter((one) => one.method !== "GET")
    const raw: unknown = jsonTextOf(sent?.bytes?.toString("utf8") ?? "{}")
    return typeof raw === "object" && raw !== null ? { ...raw } : {}
}

describe("structured output on the Anthropic Messages body (output_config.format)", () => {
    it("sends the schema as output_config.format beside the effort at high, thinking left adaptive", async () => {
        const body = await bodyOf({ effort: "high", maxTokens: 16_080 }, SCHEMA)
        expect(body.output_config).toEqual({ effort: "high", format: { type: "json_schema", schema: SCHEMA } })
        expect(body.thinking).toBeUndefined()
        expect(body.max_tokens).toBe(16_080)
    })

    it("keeps between_tools alone in thinking when the effort is off, the format still in output_config", async () => {
        const body = await bodyOf({ effort: "off" }, SCHEMA)
        expect(body.thinking).toEqual({ type: "between_tools" })
        expect(body.output_config).toEqual({ format: { type: "json_schema", schema: SCHEMA } })
    })

    it("sends no format for a call with no schema", async () => {
        expect((await bodyOf({ effort: "high" }, undefined)).output_config).toEqual({ effort: "high" })
        expect(structuredFieldsOf({ outputConfig: { effort: "low" } }, undefined)).toEqual({})
    })
})
