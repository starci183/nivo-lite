import { isZaloAuthorizationPayload, ZALO_AUTHORIZATION_QUEUE } from "./zalo-authorization.queue"

describe("Zalo authorization queue", () => {
    it("uses the queue name shared with the authorization return", () => {
        expect(ZALO_AUTHORIZATION_QUEUE).toBe("zalo_authorization")
    })

    it.each([
        { workspaceId: "workspace-1", state: "connection-1.nonce-1", code: "code-1", oaId: null },
        { workspaceId: "workspace-1", state: "connection-1.nonce-1", code: "code-1", oaId: "oa-1" },
    ])("accepts an authorization payload with its nullable OA id: %p", (payload) => {
        expect(isZaloAuthorizationPayload(payload)).toBe(true)
    })

    it.each([
        { state: "connection-1.nonce-1", code: "code-1", oaId: "oa-1" },
        { workspaceId: 1, state: "connection-1.nonce-1", code: "code-1", oaId: "oa-1" },
        { workspaceId: "workspace-1", code: "code-1", oaId: "oa-1" },
        { workspaceId: "workspace-1", state: 1, code: "code-1", oaId: "oa-1" },
        { workspaceId: "workspace-1", state: "connection-1.nonce-1", oaId: "oa-1" },
        { workspaceId: "workspace-1", state: "connection-1.nonce-1", code: 1, oaId: "oa-1" },
        { workspaceId: "workspace-1", state: "connection-1.nonce-1", code: "code-1" },
        { workspaceId: "workspace-1", state: "connection-1.nonce-1", code: "code-1", oaId: 1 },
        {},
        [],
    ])("rejects a missing or wrongly typed authorization field: %p", (payload) => {
        expect(isZaloAuthorizationPayload(payload)).toBe(false)
    })

    it.each([undefined, null, "payload", 1, true, Symbol("payload"), BigInt(1), () => undefined])(
        "rejects a non-object payload: %p",
        (payload) => {
            expect(isZaloAuthorizationPayload(payload)).toBe(false)
        },
    )
})
