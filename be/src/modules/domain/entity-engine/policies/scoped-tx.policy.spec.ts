import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { mintScopedTx } from "./scoped-tx.policy"

const SCOPED_TX: unique symbol = Symbol("entity-engine.scoped-tx")

interface ScopedTxPolicy {
    readonly mintScopedTx: typeof mintScopedTx
}

const build = async (): Promise<ScopedTxPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SCOPED_TX, useFactory: (): ScopedTxPolicy => ({ mintScopedTx }) }],
    }).compile()
    return moduleRef.get<ScopedTxPolicy>(SCOPED_TX)
}

describe("mintScopedTx", () => {
    it("hands back the manager and the workspace it was minted for", async () => {
        const policy = await build()
        const manager = mockEntityManager()

        const tx = policy.mintScopedTx({ manager, workspaceId: "ws-1" })

        expect(tx.manager).toBe(manager)
        expect(tx.workspaceId).toBe("ws-1")
    })
})
