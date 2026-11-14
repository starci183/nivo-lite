import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { jsonTextOf } from "@tests/fixtures/builders/json-text.builder"
import { Secret } from "@modules/platform/config"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { AiClient } from "./ai.client"
import type { AiBudget, AiChatRequest } from "./ai.contracts"
import { AI_ENDPOINT_OPTIONS } from "./ai.decorators"
import type { AiEndpoint } from "./ai.options"
import { anthropicThinkingFieldsOf, claudeFamilyOf, thinkingAskOf } from "./anthropic-thinking.policy"
import { JUDGE_EFFORT, JUDGE_MAX_TOKENS } from "./call-efforts.policy"

// The lane's effort reaches Anthropic in each model family's own fields (coordinator 2026-11-11, D-BR-2): proven on the BUILT
// Messages body the client sends to the gateway (a fake HTTP port: no network, no model).

/** The profiles the gateway serves on Anthropic's Messages route, and model ids a node or an env may name directly. */
const NAMES = [
    "work",
    "haiku",
    "sonnet",
    "auto-light",
    "auto-heavy",
    "claude-opus-5-5",
    "claude-fable-5-2",
    "claude-haiku-4-5",
]

/**
 * The gateway's table as the app hands it over (`ai-gateway` `chatProfileRoutes()`, proven equal in its own spec): each profile with
 * the models that may serve it, in order, and the single-model profile of each.
 */
const HAIKU = { model: "claude-haiku-5-5", profile: "haiku" }
const SONNET = { model: "claude-sonnet-5-5", profile: "sonnet" }
const ROUTES = {
    work: [HAIKU, SONNET],
    haiku: [HAIKU],
    sonnet: [SONNET],
    "auto-light": [HAIKU, SONNET],
    "auto-heavy": [SONNET, HAIKU],
}

/** Request fields no call of the lane may ever send to these models. */
const FORBIDDEN = ["temperature", "top_p", "top_k", "budget_tokens", "tool_choice"]

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
                          model: "claude-haiku-5-5",
                          content: [{ type: "text", text: '{"same":null}' }],
                          stop_reason: "end_turn",
                          stop_sequence: null,
                          usage: { input_tokens: 10, output_tokens: 6 },
                      }),
                  },
        ),
    )
    return http
}

const clientOf = async (http: HttpClient): Promise<AiClient> => {
    const endpoint = builder<AiEndpoint>({
        gatewayUrl: "http://gateway.test/v1",
        virtualKey: new Secret("sk-starci-test"),
        chatModel: "work",
        embeddingModel: "embed",
        profileRoutes: ROUTES,
    })()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AiClient,
            { provide: AI_ENDPOINT_OPTIONS, useValue: endpoint },
            { provide: HTTP_CLIENT, useValue: http },
        ],
    }).compile()
    return moduleRef.get(AiClient)
}

/** The Messages body of the one model call a client made. */
const bodyOf = (http: ReturnType<typeof mock<HttpClient>>): Readonly<Record<string, unknown>> => {
    const [sent] = http.request.mock.calls.map(([request]) => request).filter((request) => request.method !== "GET")
    const raw: unknown = jsonTextOf(sent?.bytes?.toString("utf8") ?? "{}")
    return typeof raw === "object" && raw !== null ? { ...raw } : {}
}

/** Sends one JSON call to a profile with a budget, as a brain or node call does (a retry on the next route with `hop`), and answers the body that left. */
const sentBody = async (
    name: string | null,
    budget: AiBudget | undefined,
    hop = false,
): Promise<Readonly<Record<string, unknown>>> => {
    const http = gateway()
    const request: AiChatRequest = {
        messages: [{ role: "user", content: "Same truth?" }],
        json: true,
        schema: null,
        timeoutMs: 5000,
        context: null,
        ...(budget === undefined ? {} : { budget }),
        ...(hop ? { fallback: true } : {}),
        ...(name === null ? {} : { target: { name, sampling: false, forcedToolChoice: false, upstreamFields: false } }),
    }
    await (await clientOf(http)).chat(request)
    return bodyOf(http)
}

const effortFields = (body: Readonly<Record<string, unknown>>) => ({
    model: body.model,
    thinking: body.thinking,
    output_config: body.output_config,
})

const OFF: AiBudget = { effort: "off" }
const DISABLED = { thinking: { type: "disabled" }, output_config: undefined }
const BETWEEN_TOOLS = { thinking: { type: "between_tools" }, output_config: undefined }
const LEAST = { thinking: undefined, output_config: { effort: "low" } }

describe("the lane's effort on the Anthropic Messages body, by the model that serves the call", () => {
    it("pins effort off on `work` (the brain's calls) to Haiku 5.5 with thinking disabled, its fallback hop to Sonnet 5.5 with between_tools", async () => {
        const body = await sentBody(null, { effort: "off", maxTokens: 256 })

        expect(effortFields(body)).toEqual({ model: "haiku", ...DISABLED })
        expect(body.max_tokens).toBe(256)
        // The same-meaning judge thinks (owner 2026-11-12): its effort rides as output_config, its cap leaves room for the reasoning.
        const judged = await sentBody("sonnet", { effort: JUDGE_EFFORT, maxTokens: JUDGE_MAX_TOKENS })
        expect(effortFields(judged)).toEqual({ model: "sonnet", thinking: undefined, output_config: { effort: "high" } })
        expect(judged.max_tokens).toBe(8000)
        expect(effortFields(await sentBody(null, OFF, true))).toEqual({ model: "sonnet", ...BETWEEN_TOOLS })
    })

    it("pins effort off on an Auto profile to its first model, and its hop to the other, each body built for its model", async () => {
        expect(effortFields(await sentBody("auto-light", OFF))).toEqual({ model: "haiku", ...DISABLED })
        expect(effortFields(await sentBody("auto-light", OFF, true))).toEqual({ model: "sonnet", ...BETWEEN_TOOLS })
        expect(effortFields(await sentBody("auto-heavy", OFF))).toEqual({ model: "sonnet", ...BETWEEN_TOOLS })
        expect(effortFields(await sentBody("auto-heavy", OFF, true))).toEqual({ model: "haiku", ...DISABLED })
    })

    it("keeps a single-model profile on its model, hop or not: Haiku disabled, Sonnet between_tools alone", async () => {
        expect(effortFields(await sentBody("haiku", OFF, true))).toEqual({ model: "haiku", ...DISABLED })
        expect(effortFields(await sentBody("sonnet", { effort: "off", maxTokens: 1200 }))).toEqual({
            model: "sonnet",
            ...BETWEEN_TOOLS,
        })
        expect(effortFields(await sentBody("sonnet", OFF, true))).toEqual({ model: "sonnet", ...BETWEEN_TOOLS })
    })

    it("lowers only the effort where thinking cannot be disabled (Opus 5.5, Fable) or the model is older or unknown", async () => {
        for (const name of ["claude-opus-5-5", "claude-fable-5-2", "claude-haiku-4-5"]) {
            expect(effortFields(await sentBody(name, OFF))).toEqual({ model: name, ...LEAST })
        }
    })

    it("sends output_config.effort, thinking adaptive, for low/medium/high, keeping a profile's own failover", async () => {
        // A node declaring the cheap tier asks `haiku` or Auto light; a node on Sonnet (ALL_NODES_ON_CLAUDE) asks `sonnet`.
        for (const name of ["haiku", "sonnet", "auto-light", "auto-heavy", "claude-opus-5-5"]) {
            for (const effort of ["low", "medium", "high"] as const) {
                expect(effortFields(await sentBody(name, { effort }))).toEqual({
                    model: name,
                    thinking: undefined,
                    output_config: { effort },
                })
            }
        }
        expect((await sentBody("sonnet", { effort: "minimal" })).output_config).toEqual({ effort: "low" })
        expect((await sentBody("auto-light", { effort: "low" }, true)).model).toBe("auto-light")
    })

    it("sends nothing of effort without a budget, and never a sampling field, budget_tokens or a forced tool choice", async () => {
        const bare = await sentBody("sonnet", undefined)
        expect(effortFields(bare)).toEqual({ model: "sonnet", thinking: undefined, output_config: undefined })
        for (const name of [null, ...NAMES]) {
            for (const hop of [false, true]) {
                for (const budget of [undefined, OFF, { effort: "low" as const, reasoningMaxTokens: 500 }]) {
                    const body = await sentBody(name, budget, hop)
                    for (const field of FORBIDDEN) expect(body).not.toHaveProperty(field)
                    expect(JSON.stringify(body)).not.toContain("budget_tokens")
                    expect(JSON.stringify(body.thinking ?? null)).not.toMatch(/display|block_binding/)
                }
            }
        }
    })
})

describe("thinkingAskOf", () => {
    it("reads the family from the model id; a profile name or another vendor is `other`", () => {
        const ids = [
            "claude-haiku-5-5",
            "claude-sonnet-5-5",
            "claude-opus-5-5",
            "claude-fable-5-1",
            "claude-opus-5",
            "work",
            null,
        ]
        expect(ids.map(claudeFamilyOf)).toEqual([
            "haiku-5-5",
            "sonnet-5-5",
            "always-on",
            "always-on",
            "other",
            "other",
            "other",
        ])
    })

    it("gives a profile no routes are known for the form every Claude model takes", () => {
        expect(thinkingAskOf("work", OFF, false, {})).toEqual({
            name: "work",
            model: null,
            fields: { outputConfig: { effort: "low" } },
        })
        expect(anthropicThinkingFieldsOf("claude-sonnet-5-5", { effort: "high" })).toEqual({
            outputConfig: { effort: "high" },
        })
    })
})
