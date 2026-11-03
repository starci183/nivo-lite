import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BankTransactionGraphAdapter } from "./bank-transaction-graph.adapter"
import { TransactionEntity } from "./persistence/entities"

const turn: NodeTurn = {
    turnId: "turn-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    subject: null,
    conversationId: null,
    locale: "vi",
}

const credit = Object.assign(new TransactionEntity(), {
    id: "tx-95958515",
    workspaceId: "ws-1",
    amountVnd: 5000,
    reference: "BUI NGUYEN DINH Test sepay Chuyen tien dat chau hoa- Ma GD ACSP/ 7o940",
    payer: null,
    occurredAt: new Date("2026-11-04T01:06:00.000Z"),
    orderId: null,
    status: "unmatched",
})

const build = async () => {
    const em = mockEntityManager({ find: [TransactionEntity, [credit]] })
    const registry = mock<GraphNodeRegistryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BankTransactionGraphAdapter,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: GraphNodeRegistryService, useValue: registry },
        ],
    }).compile()
    return { adapter: moduleRef.get(BankTransactionGraphAdapter), registry, em }
}

describe("BankTransactionGraphAdapter", () => {
    it("registers itself as the port of the bank-transaction kind", async () => {
        const { adapter, registry } = await build()
        adapter.onModuleInit()
        expect(registry.addDataPort).toHaveBeenCalledWith(adapter)
        expect(adapter.kind).toBe("bank-transaction")
    })

    it("reads the workspace's credits cut to the asked fields, with the instant as ISO text and a missing content as empty", async () => {
        const { adapter, em } = await build()

        await expect(
            adapter.read(turn, { where: { id: "tx-95958515", status: "unmatched", amountVnd: 5000, orderId: "o" }, fields: ["id", "amountVnd", "content", "receivedAt", "orderId"], limit: 999 }, "workspace"),
        ).resolves.toEqual([
            {
                id: "tx-95958515",
                amountVnd: 5000,
                content: "BUI NGUYEN DINH Test sepay Chuyen tien dat chau hoa- Ma GD ACSP/ 7o940",
                receivedAt: "2026-11-04T01:06:00.000Z",
                orderId: null,
            },
        ])

        expect(em.find).toHaveBeenCalledWith(TransactionEntity, {
            where: { id: "tx-95958515", status: "unmatched", amountVnd: 5000, orderId: "o", workspaceId: "ws-1", direction: "credit" },
            order: { occurredAt: "DESC" },
            take: 200,
        })
        const [empty] = await adapter.read(turn, { fields: ["content"] }, "workspace")
        expect(empty).toBeDefined()
    })

    it("reads a null reference as an empty content", async () => {
        const { adapter, em } = await build()
        em.find.mockResolvedValue([Object.assign(new TransactionEntity(), { ...credit, reference: null })])
        await expect(adapter.read(turn, { fields: ["content"] }, "workspace")).resolves.toEqual([{ content: "" }])
    })

    it("keeps a turn read to the transaction the turn is about", async () => {
        const { adapter, em } = await build()
        const subject = { kind: "bank-transaction", id: "tx-95958515" }

        await adapter.read({ ...turn, subject }, { fields: ["id"] }, "turn")
        await expect(adapter.read(turn, { fields: ["id"] }, "turn")).resolves.toEqual([])
        await expect(adapter.read({ ...turn, subject: { kind: "order", id: "o" } }, { fields: ["id"] }, "turn")).resolves.toEqual([])

        expect(em.find).toHaveBeenCalledTimes(1)
        expect(em.find).toHaveBeenCalledWith(
            TransactionEntity,
            expect.objectContaining({ where: { workspaceId: "ws-1", direction: "credit", id: "tx-95958515" } }),
        )
    })
})
