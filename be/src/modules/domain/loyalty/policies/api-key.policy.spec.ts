import { builder } from "@starci/jest-preset"
import { API_KEY_RATE_LIMIT, bearerKey, hashApiKey, verdictOf } from "./api-key.policy"
import type { ApiKeyAuth } from "./api-key.policy"

const authOf = builder<ApiKeyAuth>({
    id: "k1",
    workspace_id: "ws-1",
    name: "Till",
    scopes: ["loyalty:read"],
    revoked: false,
    hits: 1,
})

describe("api-key.policy", () => {
    describe("bearerKey", () => {
        it("reads the key of a bearer header, whatever the case of the word", () => {
            expect(bearerKey("Bearer nvk_abc")).toBe("nvk_abc")
            expect(bearerKey("bearer nvk_abc")).toBe("nvk_abc")
        })

        it("answers an empty text when the header carries no key", () => {
            expect(bearerKey("")).toBe("")
            expect(bearerKey("Basic abc")).toBe("")
            expect(bearerKey("Bearer a b")).toBe("")
        })
    })

    describe("hashApiKey", () => {
        it("is the SHA-256 of the key", () => {
            expect(hashApiKey("nvk_abc")).toMatch(/^[0-9a-f]{64}$/u)
            expect(hashApiKey("nvk_abc")).not.toBe(hashApiKey("nvk_abd"))
        })
    })

    describe("verdictOf", () => {
        it("lets a live key with the scope through", () => {
            expect(verdictOf("nvk_abc", authOf(), "loyalty:read")).toBe("ok")
            expect(verdictOf("nvk_abc", authOf({ hits: API_KEY_RATE_LIMIT }), "loyalty:read")).toBe("ok")
        })

        it("refuses a key that is not a key or that the database does not know", () => {
            expect(verdictOf("abc", authOf(), "loyalty:read")).toBe("invalid")
            expect(verdictOf("nvk_abc", null, "loyalty:read")).toBe("invalid")
        })

        it("refuses a revoked key, a key over its rate and a key without the scope", () => {
            expect(verdictOf("nvk_abc", authOf({ revoked: true }), "loyalty:read")).toBe("revoked")
            expect(verdictOf("nvk_abc", authOf({ hits: API_KEY_RATE_LIMIT + 1 }), "loyalty:read")).toBe("rate_limited")
            expect(verdictOf("nvk_abc", authOf(), "loyalty:write")).toBe("scope_missing")
        })
    })
})
