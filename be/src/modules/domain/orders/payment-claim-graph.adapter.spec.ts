import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { OrderPaymentClaimsService } from "./order-payment-claims.service"
import { PaymentDemandService } from "./payment-demand.service"
import type { PaymentClaimRow } from "./orders.contracts"
import { PaymentClaimGraphAdapter } from "./payment-claim-graph.adapter"

const turn: NodeTurn = {
    turnId: "turn-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    subject: null,
    conversationId: "conversation-dinh",
    locale: "vi",
}

const claimRow: PaymentClaimRow = {
    id: "claim-dinh",
    workspaceId: "ws-1",
    leadId: "lead-dinh",
    conversationId: "conversation-dinh",
    amountVnd: 5000,
    names: ["BUI NGUYEN DINH"],
    body: "I transferred 5k, name BUI NGUYEN DINH",
    claimedAt: new Date("2026-11-04T00:54:00.000Z"),
    status: "open",
}

const build = async () => {
    const registry = mock<GraphNodeRegistryService>()
    const claims = mock<OrderPaymentClaimsService>()
    claims.matching.mockResolvedValue([claimRow])
    const demand = mock<PaymentDemandService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentClaimGraphAdapter,
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: OrderPaymentClaimsService, useValue: claims },
            { provide: PaymentDemandService, useValue: demand },
        ],
    }).compile()
    return { adapter: moduleRef.get(PaymentClaimGraphAdapter), registry, claims, demand }
}

describe("PaymentClaimGraphAdapter", () => {
    it("registers itself as the port of the payment-claim kind and the executor of payment-claim.record", async () => {
        const { adapter, registry } = await build()
        adapter.onModuleInit()
        expect(registry.addDataPort).toHaveBeenCalledWith(adapter)
        expect(registry.addExecutor).toHaveBeenCalledWith(adapter)
        expect([adapter.kind, adapter.effect]).toEqual(["payment-claim", "payment-claim.record"])
    })

    it("reads the workspace's claims cut to the asked fields, reading instants as ISO text", async () => {
        const { adapter, claims } = await build()

        await expect(
            adapter.read(
                turn,
                { where: { status: "open", ignored: "x" }, fields: ["id", "claimedAt", "names"] },
                "workspace",
            ),
        ).resolves.toEqual([{ id: "claim-dinh", claimedAt: "2026-11-04T00:54:00.000Z", names: ["BUI NGUYEN DINH"] }])

        expect(claims.matching).toHaveBeenCalledWith("ws-1", { status: "open" }, 200)
    })

    it("reads nothing for a status no claim has", async () => {
        const { adapter, claims } = await build()

        await expect(adapter.read(turn, { where: { status: "bogus" }, fields: ["id"] }, "workspace")).resolves.toEqual(
            [],
        )

        expect(claims.matching).not.toHaveBeenCalled()
    })

    it("honours the limit of a workspace read", async () => {
        const { adapter, claims } = await build()
        await adapter.read(turn, { fields: ["id"], limit: 3 }, "workspace")
        expect(claims.matching).toHaveBeenCalledWith("ws-1", {}, 3)
    })

    it("keeps a turn read to the conversation of the turn, and reads nothing for a turn with none", async () => {
        const { adapter, claims } = await build()

        await adapter.read(
            turn,
            { where: { leadId: "lead-dinh", id: "claim-dinh", conversationId: "other" }, fields: ["id"], limit: 5 },
            "turn",
        )
        await expect(adapter.read({ ...turn, conversationId: null }, { fields: ["id"] }, "turn")).resolves.toEqual([])

        expect(claims.matching).toHaveBeenCalledTimes(1)
        expect(claims.matching).toHaveBeenCalledWith(
            "ws-1",
            { leadId: "lead-dinh", id: "claim-dinh", conversationId: "conversation-dinh" },
            5,
        )
    })
})

describe("PaymentClaimGraphAdapter records", () => {
    it("records what the customer said once per business key, falling back to the step key", async () => {
        const { adapter, claims, demand } = await build()
        claims.record.mockResolvedValue("claim-new")
        const payload = {
            leadId: "lead-dinh",
            conversationId: "conversation-dinh",
            amountVnd: 5000,
            names: ["BUI NGUYEN DINH"],
            body: "5k",
        }

        await expect(adapter.execute(turn, payload, { key: "run:1", dedupeKey: "claim:zalo:1" })).resolves.toEqual({
            kind: "payment-claim",
            id: "claim-new",
        })
        await adapter.execute(turn, { leadId: "lead-dinh", body: "paid already" }, { key: "run:2", dedupeKey: null })

        expect(demand.claimOpen).toHaveBeenCalledWith("ws-1")
        expect(claims.record).toHaveBeenNthCalledWith(1, {
            workspaceId: "ws-1",
            leadId: "lead-dinh",
            conversationId: "conversation-dinh",
            amountVnd: 5000,
            names: ["BUI NGUYEN DINH"],
            body: "5k",
            dedupeKey: "claim:zalo:1",
        })
        expect(claims.record).toHaveBeenNthCalledWith(2, {
            workspaceId: "ws-1",
            leadId: "lead-dinh",
            conversationId: null,
            amountVnd: null,
            names: [],
            body: "paid already",
            dedupeKey: "run:2",
        })
    })

    it("records the claim of a conversation whose customer is no lead yet, with no lead", async () => {
        const { adapter, claims } = await build()
        claims.record.mockResolvedValue("claim-new")

        await adapter.execute(
            turn,
            { leadId: null, conversationId: "conversation-new", body: "paid already" },
            { key: "run:3", dedupeKey: null },
        )

        expect(claims.record).toHaveBeenCalledWith(
            expect.objectContaining({ leadId: null, conversationId: "conversation-new", dedupeKey: "run:3" }),
        )
    })

    it("escalates a claim through the ledger, once", async () => {
        const { adapter, claims } = await build()
        claims.escalate.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
        await expect(adapter.escalate("ws-1", "claim-dinh")).resolves.toBe(true)
        await expect(adapter.escalate("ws-1", "claim-dinh")).resolves.toBe(false)
    })
})
