import assert from "node:assert/strict"
import type { mock } from "@starci/jest-preset"
import type { HttpClient } from "@modules/platform/http"
import { isRecord, parseJsonText } from "@modules/platform/primitives"

/** A chat-completion answer of the gateway (OpenAI route) carrying `content`. */
export const gatewayCompletion = (content: string): string =>
    JSON.stringify({
        id: "chatcmpl-1",
        object: "chat.completion",
        created: 1,
        model: "fake-model",
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
        usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
    })

/** An embeddings answer of the gateway: `count` two-number vectors. */
export const gatewayVectors = (count: number): string =>
    JSON.stringify({
        object: "list",
        model: "fake-embed",
        data: Array.from({ length: count }, (_, index) => ({ object: "embedding", index, embedding: [index, 1] })),
        usage: { prompt_tokens: count, total_tokens: count },
    })

/** An answer of the gateway's Anthropic Messages route, with the lane the gateway names in its usage (`usage.served`). */
export const gatewayAnthropicMessage = (content: string): string =>
    JSON.stringify({
        id: "msg_1",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-5-5",
        content: [{ type: "text", text: content }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: {
            input_tokens: 10,
            output_tokens: 2,
            cache_read_input_tokens: 5,
            cache_creation_input_tokens: 3,
            served: { provider: "anthropic", model: "claude-sonnet-5-5", attempts: 1, cost: 0.0012 },
        },
    })

/** The names the fake gateway lists (`GET /v1/models`), each with the protocols it is served through. */
const CATALOG: ReadonlyArray<{ readonly id: string; readonly kinds: ReadonlyArray<string>; readonly serves: ReadonlyArray<string> }> = [
    { id: "work", kinds: ["openai"], serves: ["chat"] },
    { id: "upstream-profile", kinds: ["openai"], serves: ["chat"] },
    { id: "sonnet", kinds: ["openai"], serves: ["chat"] },
    { id: "deepseek", kinds: ["openai"], serves: ["chat"] },
    { id: "auto-light", kinds: ["openai"], serves: ["chat"] },
    { id: "claude", kinds: ["anthropic"], serves: ["chat"] },
    { id: "both", kinds: ["anthropic", "openai"], serves: ["chat"] },
    { id: "embed", kinds: ["openai"], serves: ["embeddings"] },
]

const catalogBody = (): string => JSON.stringify({ object: "list", data: CATALOG.map((entry) => ({ object: "model", ...entry })) })

/** A fake gateway that answers its catalog and every other request with `body`. */
export const gatewayAnswering = (http: ReturnType<typeof mock<HttpClient>>, body: (url: string) => unknown, headers?: Record<string, string>) => {
    http.request.mockImplementation((request) =>
        Promise.resolve(
            request.method === "GET"
                ? { status: 200, headers: { "content-type": "application/json" }, body: catalogBody() }
                : { status: 200, ...(headers === undefined ? {} : { headers }), body: body(request.url) },
        ),
    )
}

/** The model calls the client sent (the catalog reads left out). */
export const gatewayPostsOf = (http: ReturnType<typeof mock<HttpClient>>) =>
    http.request.mock.calls.map(([request]) => request).filter((request) => request.method !== "GET")

/** What the n-th model call of the client sent to the gateway (the catalog reads left out); the body as text. */
export const gatewaySentOf = (http: ReturnType<typeof mock<HttpClient>>, at: number) => {
    const request = gatewayPostsOf(http)[at]
    return {
        url: request?.url ?? "",
        timeoutMs: request?.timeoutMs ?? 0,
        headers: request?.headers ?? {},
        text: request?.bytes?.toString("utf8") ?? "",
    }
}

/** The body text of a model call as a record; the spec fails when it is not a JSON object. */
export const gatewayJsonBodyOf = (text: string): Record<string, unknown> => {
    const read = parseJsonText(text)
    assert.ok(read.ok, "AI request body was not valid JSON")
    assert.ok(isRecord(read.value), "AI request body was not a JSON object")
    return read.value
}
