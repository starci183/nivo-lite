import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { PaymentAccountGraphService } from "./payment-account-graph.service"
import { WorkspacePaymentAccountService } from "./workspace-payment-account.service"

const TURN: NodeTurn = {
    turnId: "turn-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    subject: null,
    conversationId: null,
    locale: "vi",
}

const ACCOUNT = { accountNumber: "525209999", bankCode: "MB", holder: "LAN", provider: "sepay", connectionId: "c1" }

const build = async () => {
    const accounts = mock<WorkspacePaymentAccountService>()
    const registry = mock<GraphNodeRegistryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentAccountGraphService,
            { provide: WorkspacePaymentAccountService, useValue: accounts },
            { provide: GraphNodeRegistryService, useValue: registry },
        ],
    }).compile()
    moduleRef.get(PaymentAccountGraphService).onModuleInit()
    const port = registry.addDataPort.mock.calls[0]?.[0]
    assert(port !== undefined)
    return { accounts, registry, port }
}

const buildWithoutRegistry = async () => {
    const accounts = mock<WorkspacePaymentAccountService>()
    const moduleRef = await Test.createTestingModule({
        providers: [PaymentAccountGraphService, { provide: WorkspacePaymentAccountService, useValue: accounts }],
    }).compile()
    return moduleRef.get(PaymentAccountGraphService)
}

const FIELDS = ["provider", "bankCode", "bankName", "accountNumber", "accountHolder", "connectionId"]

describe("PaymentAccountGraphService", () => {
    it("registers the payment-account port, and nothing when the app hosts no graph nodes", async () => {
        const { port, registry } = await build()
        const bare = await buildWithoutRegistry()

        expect(port.kind).toBe("payment-account")
        expect(registry.addDataPort).toHaveBeenCalledTimes(1)
        expect(() => bare.onModuleInit()).not.toThrow()
    })

    it("reads the account of the turn workspace with the bank name spelled out", async () => {
        const { accounts, port } = await build()
        accounts.accountOf.mockResolvedValue(ACCOUNT)

        const rows = await port.read(TURN, { fields: FIELDS }, "workspace")

        expect(accounts.accountOf).toHaveBeenCalledWith("ws-1")
        expect(rows).toEqual([
            {
                provider: "sepay",
                bankCode: "MB",
                bankName: "MB Bank",
                accountNumber: "525209999",
                accountHolder: "LAN",
                connectionId: "c1",
            },
        ])
    })

    it("answers an empty holder when the feed has none, and the same account for a turn scope", async () => {
        const { accounts, port } = await build()
        accounts.accountOf.mockResolvedValue({ ...ACCOUNT, holder: null })

        await expect(port.read(TURN, { fields: ["accountHolder"] }, "turn")).resolves.toEqual([{ accountHolder: "" }])
    })

    it("answers no row when the workspace has no bank feed with a full account number", async () => {
        const { accounts, port } = await build()
        accounts.accountOf.mockResolvedValue(null)

        await expect(port.read(TURN, { fields: FIELDS }, "workspace")).resolves.toEqual([])
    })
})
