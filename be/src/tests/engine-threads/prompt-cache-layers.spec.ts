import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { defineEffect, guidedModelRequest } from "@nivo-lite/agent-sdk/node"
import type { ModelCallFrame, NodeModelRequest } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN } from "@nivo-lite/agent-sdk/testing"
import { z } from "zod"
import {
    CONSULT_GOAL_VI,
    CONSULT_SHORT_GOAL_VI,
    CONSULT_WORD_VI,
    CUSTOMER_ROSES_QUESTION_VI,
    FLORIST_GUIDANCE_OPENING_VI,
    FLORIST_GUIDANCE_VI,
    ORDER_GOAL_VI,
    ORDER_WORDS_VI,
    POLITE_YES_VI,
    STILL_ROSES_VI,
} from "@tests/fixtures/i18n/engine-threads-spec.messages"
import { nodeMessagesOf } from "@modules/domain/ai-tasks/node-prompt.policy"
import { AiClient } from "@modules/integrations/ai/ai.client"
import type { AiChatRequest } from "@modules/integrations/ai/ai.contracts"
import { AI_ENDPOINT_OPTIONS } from "@modules/integrations/ai/ai.decorators"
import type { AiEndpoint } from "@modules/integrations/ai/ai.options"
import { Secret } from "@modules/platform/config"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient, HttpRequest } from "@modules/platform/http"
import { parseJsonText } from "@modules/platform/primitives"

// ENG1 (handoff 2026-11-11 item 4, DESIGN "PROMPT CACHE": craft+tools → shop rules → step → volatile): on dev a node's first call
// WROTE the cache (3–15k tokens) on nearly every step, and read only within the same step. The stable part went as ONE system text
// marked at its end (L3), so another step of the same agent, whose L3 differs, found no cache entry at the end of L1 + L2. Now the
// host names where L1 + L2 end (`sharedLength`) and the call is sent as two marked system parts. Proven on the BUILT request the
// Anthropic client sends to the gateway (a fake HTTP port: no live call).

const send = defineEffect({
    id: "nivo.tool.customer.message.send",
    title: { key: "t.send" },
    payload: z.object({ conversationId: z.string().max(200), text: z.string().max(200) }),
})
const settle = defineEffect({
    id: "nivo.tool.payment.order.settle",
    title: { key: "t.settle" },
    payload: z.object({ orderId: z.string().max(200), transactionId: z.string().max(200) }),
})

/** One agent, one shop: the craft and the whole tool set every step of the agent carries. */
const FRAME: ModelCallFrame = {
    turn: {
        ...EXAMPLE_TURN,
        guidance: FLORIST_GUIDANCE_VI,
        agentTools: ["nivo.tool.payment.order.settle", "nivo.tool.customer.message.send"],
    },
    effects: new Map([send, settle].map((effect) => [effect.id, effect])),
    tools: new Map(),
}

/** A step's call of the agent, laid out by the SDK's host exactly as a node's call is (`guidedModelRequest`). */
const stepCall = (goal: string, input: unknown): NodeModelRequest =>
    guidedModelRequest(FRAME, { purpose: "sales.consult-turn:consult", instructions: goal, input })

const ANSWER = z.object({ reply: z.string().max(2000) })

/** The gateway: its catalog (one name served through Anthropic's Messages route) and an answer to every call. */
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
                          data: [{ object: "model", id: "claude", kinds: ["anthropic"], serves: ["chat"] }],
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
                          content: [{ type: "text", text: `{"reply":"${POLITE_YES_VI}"}` }],
                          stop_reason: "end_turn",
                          stop_sequence: null,
                          usage: { input_tokens: 10, output_tokens: 2 },
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
        chatModel: "claude",
        embeddingModel: "embed",
    })()
    const moduleRef = await Test.createTestingModule({
        providers: [AiClient, { provide: AI_ENDPOINT_OPTIONS, useValue: endpoint }, { provide: HTTP_CLIENT, useValue: http }],
    }).compile()
    return moduleRef.get(AiClient)
}

/** One text part of the system the Anthropic client sent. */
interface SystemPart {
    readonly type: string
    readonly text: string
    readonly cache_control?: CacheControl
}

/** The cache breakpoint of a system part. */
interface CacheControl {
    /** The breakpoint's lifetime kind. */
    readonly type: string
}

/** Whether a parsed JSON value is an object with named members. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === "object" && value !== null

/** Whether a parsed JSON value is a text part of the system the client sent. */
const isSystemPart = (value: unknown): value is SystemPart =>
    isRecord(value) && typeof value.type === "string" && typeof value.text === "string"

/** The body of a request the client sent, or an empty one when its bytes are no JSON object. */
const bodyOf = (request: HttpRequest): Readonly<Record<string, unknown>> => {
    const read = parseJsonText(request.bytes?.toString("utf8") ?? "{}")
    return read.ok && isRecord(read.value) ? read.value : {}
}

/** The body the client sent for each model call (the catalog reads left out). */
const bodiesOf = (http: ReturnType<typeof mock<HttpClient>>): ReadonlyArray<Readonly<Record<string, unknown>>> =>
    http.request.mock.calls
        .map(([request]) => request)
        .filter((request) => request.method !== "GET")
        .map((request) => bodyOf(request))

const systemOf = (body: Readonly<Record<string, unknown>>): ReadonlyArray<SystemPart> =>
    Array.isArray(body.system) ? body.system.filter(isSystemPart) : []

/** Sends a step's call as the engine does: the node prompt's messages, on the Anthropic route. */
const sent = async (client: AiClient, ask: NodeModelRequest): Promise<void> => {
    const request: AiChatRequest = {
        messages: nodeMessagesOf(ask, ANSWER),
        json: true,
        schema: null,
        timeoutMs: 5000,
        context: null,
        target: { name: "claude", sampling: false, forcedToolChoice: false, upstreamFields: false },
    }
    await client.chat(request)
}

describe("prompt cache: L1 is read ACROSS the steps of one run (the built Anthropic request)", () => {
    it("sends two steps of one agent with the same first system part, byte for byte, each layer end marked", async () => {
        const http = gateway()
        const client = await clientOf(http)

        await sent(client, stepCall(CONSULT_GOAL_VI, { thread: [CUSTOMER_ROSES_QUESTION_VI] }))
        await sent(client, stepCall(ORDER_GOAL_VI, { orderId: "o-1", at: "2026-11-11T10:00:00Z" }))

        const [consult, order] = bodiesOf(http).map(systemOf)
        // L1: the agent's craft and its whole tool set; identical, marked, and holding nothing of either step.
        expect(consult?.[0]?.text).toBe(order?.[0]?.text)
        expect(consult?.[0]?.cache_control).toEqual({ type: "ephemeral" })
        expect(order?.[0]?.cache_control).toEqual({ type: "ephemeral" })
        expect(consult?.[0]?.text.startsWith(FLORIST_GUIDANCE_OPENING_VI)).toBe(true)
        expect(consult?.[0]?.text).toContain('"name":"nivo.tool.customer.message.send"')
        expect(consult?.[0]?.text).not.toMatch(new RegExp(`${CONSULT_WORD_VI}|${ORDER_WORDS_VI}|o-1|2026-11-11`, "u"))
        // L3: the step's own words and the answer's schema, marked at its end; different per step.
        expect(consult?.[1]?.text.startsWith(CONSULT_GOAL_VI)).toBe(true)
        expect(order?.[1]?.text.startsWith(ORDER_GOAL_VI)).toBe(true)
        expect(consult?.[1]?.cache_control).toEqual({ type: "ephemeral" })
        // The volatile input is never in the system: it is the user message.
        expect(JSON.stringify(consult)).not.toContain(STILL_ROSES_VI)
    })

    it("stays within Anthropic's four breakpoints: two layer ends and the automatic one", async () => {
        const http = gateway()
        await sent(await clientOf(http), stepCall(CONSULT_SHORT_GOAL_VI, {}))

        const [body] = bodiesOf(http)
        const marks = (JSON.stringify(body).match(/"cache_control"/gu) ?? []).length
        expect(body?.cache_control).toEqual({ type: "ephemeral" })
        expect(marks).toBe(3)
    })

    it("sends the instructions unchanged: the parts joined by the blank line are the host's text", async () => {
        const http = gateway()
        const ask = stepCall(CONSULT_SHORT_GOAL_VI, {})
        await sent(await clientOf(http), ask)

        const [system] = bodiesOf(http).map(systemOf)
        expect(`${system?.[0]?.text ?? ""}\n\n${system?.[1]?.text ?? ""}`.startsWith(ask.instructions)).toBe(true)
    })

    it("keeps ONE marked part for a call with no shared opening (a turn with no craft and no values)", async () => {
        const http = gateway()
        const bare = guidedModelRequest(
            { turn: EXAMPLE_TURN, effects: new Map(), tools: new Map() },
            { purpose: "p", instructions: CONSULT_SHORT_GOAL_VI, input: {} },
        )
        await sent(await clientOf(http), bare)

        const [system] = bodiesOf(http).map(systemOf)
        expect(system?.filter((part) => part.cache_control !== undefined)).toHaveLength(1)
        expect(system?.[0]?.text.startsWith(CONSULT_SHORT_GOAL_VI)).toBe(true)
    })
})
