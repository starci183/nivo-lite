import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { connectionAttentionOf as connectionAttentionOfSubject } from "./connection-attention.policy"

const SUBJECT = Symbol("connection-attention.policy")

const build = async (): Promise<{ connectionAttentionOf: typeof connectionAttentionOfSubject }> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<{ connectionAttentionOf: typeof connectionAttentionOfSubject }>({ connectionAttentionOf: connectionAttentionOfSubject }) }],
    }).compile()
    return moduleRef.get<{ connectionAttentionOf: typeof connectionAttentionOfSubject }>(SUBJECT)
}

describe("connectionAttentionOf", () => {
    let connectionAttentionOf: typeof connectionAttentionOfSubject

    beforeAll(async () => {
        ;({ connectionAttentionOf } = await build())
    })

    it.each([
        ["a refused credential while the status says error", { status: "error", health: "needs_reauth" }, "needs_reauth"],
        ["a refused credential after the owner connected again", { status: "connected", health: "needs_reauth" }, null],
        ["a connected account whose poll breaker is open", { status: "connected", health: "degraded" }, "degraded"],
        ["a disconnected account", { status: "disconnected", health: "degraded" }, null],
        ["a failing or silent account", { status: "error", health: "failing" }, null],
        ["an account with no recorded health", { status: "connected" }, null],
    ] as const)("answers for %s", (_name, connection, expected) => {
        expect(connectionAttentionOf(connection)).toBe(expected)
    })
})
