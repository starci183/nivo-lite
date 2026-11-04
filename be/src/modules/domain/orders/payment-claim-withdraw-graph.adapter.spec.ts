import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { OrderPaymentClaimsService } from "./order-payment-claims.service"
import { PaymentClaimWithdrawGraphAdapter } from "./payment-claim-withdraw-graph.adapter"

const turn: NodeTurn = {
    turnId: "turn-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    subject: null,
    conversationId: null,
    locale: "vi",
}

const build = async () => {
    const registry = mock<GraphNodeRegistryService>()
    const claims = mock<OrderPaymentClaimsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentClaimWithdrawGraphAdapter,
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: OrderPaymentClaimsService, useValue: claims },
        ],
    }).compile()
    return { adapter: moduleRef.get(PaymentClaimWithdrawGraphAdapter), registry, claims }
}

describe("PaymentClaimWithdrawGraphAdapter", () => {
    it("registers itself as the executor of payment-claim.withdraw", async () => {
        const { adapter, registry } = await build()
        adapter.onModuleInit()
        expect(registry.addExecutor).toHaveBeenCalledWith(adapter)
        expect(adapter.effect).toBe("payment-claim.withdraw")
    })

    it("withdraws the claim of the payload through the ledger, which leaves a settled claim as it is, and answers the claim", async () => {
        const { adapter, claims } = await build()

        await expect(adapter.execute(turn, { id: "claim-dinh" })).resolves.toEqual({
            kind: "payment-claim",
            id: "claim-dinh",
        })
        await adapter.execute(turn, { id: "claim-dinh" })

        expect(claims.withdraw).toHaveBeenCalledTimes(2)
        expect(claims.withdraw).toHaveBeenCalledWith("ws-1", "claim-dinh")
    })
})
