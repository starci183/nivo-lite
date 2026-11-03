import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeDataPort, NodeTurn } from "@modules/domain/graph-nodes"
import type { LeadRecordRow } from "./lead-records.contracts"
import { LeadRecordsService } from "./lead-records.service"
import { LeadsGraphService } from "./leads-graph.service"

const TURN: NodeTurn = {
    turnId: "turn-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    subject: null,
    conversationId: null,
    locale: "vi",
}

const LEAD: LeadRecordRow = {
    id: "lead-1",
    workspace_id: "ws-1",
    contact_name: "An",
    company: "ACME",
    channel: "Zalo",
    need: "tea",
    stage: "new",
    context_summary: "asked the price",
    phone: "84912000701",
    email: null,
}

const build = async (withRegistry = true) => {
    const records = mock<LeadRecordsService>()
    const registry = mock<GraphNodeRegistryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadsGraphService,
            { provide: LeadRecordsService, useValue: records },
            ...(withRegistry ? [{ provide: GraphNodeRegistryService, useValue: registry }] : []),
        ],
    }).compile()
    moduleRef.get(LeadsGraphService).onModuleInit()
    return { records, registry, port: registry.addDataPort.mock.calls[0]?.[0] as NodeDataPort }
}

const FIELDS = ["id", "contactName", "company", "channel", "need", "stage", "phone", "email", "contextSummary"]

describe("LeadsGraphService", () => {
    it("registers the sales-lead port, and nothing when the app hosts no graph nodes", async () => {
        const { port } = await build()
        const { registry } = await build(false)

        expect(port.kind).toBe("sales-lead")
        expect(registry.addDataPort).not.toHaveBeenCalled()
    })

    it("reads the lead the turn is about, with the fields of the data kind", async () => {
        const { records, port } = await build()
        records.find.mockResolvedValue(LEAD)

        const rows = await port.read({ ...TURN, subject: { kind: "sales-lead", id: "lead-1" } }, { fields: FIELDS }, "turn")

        expect(records.find).toHaveBeenCalledWith("ws-1", "lead-1")
        expect(rows).toEqual([
            {
                id: "lead-1",
                contactName: "An",
                company: "ACME",
                channel: "Zalo",
                need: "tea",
                stage: "new",
                phone: "84912000701",
                email: null,
                contextSummary: "asked the price",
            },
        ])
    })

    it("reads no lead for a turn about nothing else, or about a lead that is gone", async () => {
        const { records, port } = await build()
        records.find.mockResolvedValue(null)

        await expect(port.read(TURN, { fields: ["id"] }, "turn")).resolves.toEqual([])
        await expect(
            port.read({ ...TURN, subject: { kind: "order", id: "o1" } }, { fields: ["id"] }, "turn"),
        ).resolves.toEqual([])
        await expect(
            port.read({ ...TURN, subject: { kind: "sales-lead", id: "x" } }, { fields: ["id"] }, "turn"),
        ).resolves.toEqual([])
    })

    it("reads the leads of the workspace for a workspace scope", async () => {
        const { records, port } = await build()
        records.list.mockResolvedValue([LEAD, { ...LEAD, id: "lead-2", stage: "won" }])

        await expect(port.read(TURN, { where: { stage: "won" }, fields: ["id"] }, "workspace")).resolves.toEqual([
            { id: "lead-2" },
        ])
        expect(records.list).toHaveBeenCalledWith("ws-1", 500)
    })
})
