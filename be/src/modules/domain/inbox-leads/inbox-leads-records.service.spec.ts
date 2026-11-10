import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { EngineResult, EntitiesApi, ListPage, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { InboxLeadsRecordsService } from "./inbox-leads-records.service"

const WORKSPACE = "11111111-1111-4111-8111-111111111111"
const LEAD = "33333333-3333-4333-8333-333333333333"
const AGENT = "44444444-4444-4444-8444-444444444444"

const recordOf = (id: string, data: Readonly<Record<string, unknown>>): RecordRow => ({
    id,
    workspaceId: WORKSPACE,
    version: "3",
    createdAt: "2026-11-09T07:00:00.000Z",
    updatedAt: "2026-11-09T08:00:00.000Z",
    data,
})

const pageOf = (...rows: ReadonlyArray<RecordRow>): ListPage => ({
    rows: rows.map((row) => ({ row, joined: {}, position: [], included: {} })),
    next: null,
})

const build = async () => {
    const engine = mock<EntityEngineService>()
    const ports = mock<EntityPortsService>()
    const api = mock<EntitiesApi>()
    engine.scoped.mockImplementation((_workspace, work) => work(mock<ScopedTx>()))
    ports.entitiesApi.mockReturnValue(api)
    const moduleRef = await Test.createTestingModule({
        providers: [
            InboxLeadsRecordsService,
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityPortsService, useValue: ports },
        ],
    }).compile()
    return { records: moduleRef.get(InboxLeadsRecordsService), api }
}

describe("InboxLeadsRecordsService read", () => {
    it("reads the leads with their orders, newest conversations and Zalo links", async () => {
        const { records, api } = await build()
        api.list
            .mockResolvedValueOnce(
                pageOf(
                    recordOf(LEAD, {
                        contactName: "Cam",
                        channel: "website",
                        stage: "new",
                        owner: AGENT,
                        quoteVnd: "4000",
                        phone: "84900000101",
                    }),
                    recordOf("l2", { contactName: "Cuong", owner: "not-an-id" }),
                    recordOf("l3", {}),
                ),
            )
            .mockResolvedValueOnce(
                pageOf(
                    recordOf("o1", {
                        leadId: LEAD,
                        orderNo: "DH-1",
                        status: "paid",
                        amountVnd: 5000,
                        shippedAt: "2026-11-09T09:00:00.000Z",
                        itemsText: "roses",
                        note: "card",
                    }),
                    recordOf("o2", { orderNo: "DH-2" }),
                    recordOf("o3", { leadId: LEAD }),
                ),
            )
            .mockResolvedValueOnce(
                pageOf(
                    recordOf("c1", { leadId: LEAD, agentId: AGENT, status: "needs", lastText: "hi", channel: "zalo" }),
                    recordOf("c2", { leadId: LEAD, channel: "website" }),
                    recordOf("c3", {}),
                    recordOf("c4", { leadId: "l2" }),
                ),
            )

        const read = await records.read(WORKSPACE, null)

        expect(read.leads.map((lead) => [lead.id, lead.name, lead.ownerAgentId, lead.quoteVnd])).toEqual([
            [LEAD, "Cam", AGENT, 4000],
            ["l2", "Cuong", null, null],
            ["l3", "", null, null],
        ])
        expect(read.leads[1]).toMatchObject({ channel: "website", stage: "new" })
        expect(read.orders.get(LEAD)).toEqual([
            expect.objectContaining({ id: "o1", orderNo: "DH-1", status: "paid", isShipped: true, amountVnd: 5000 }),
            expect.objectContaining({ id: "o3", orderNo: "", status: "draft", isShipped: false }),
        ])
        expect(read.conversations.get(LEAD)).toEqual({
            agentId: AGENT,
            status: "needs",
            lastText: "hi",
            channel: "zalo",
        })
        expect(read.conversations.get("l2")).toEqual({ agentId: null, status: "ai", lastText: "", channel: "website" })
        expect([...read.zaloLeadIds]).toEqual([LEAD])
    })

    it("reads only the given leads, narrowed by a search, and reads nothing more when there are none", async () => {
        const { records, api } = await build()
        api.list.mockResolvedValueOnce(pageOf())

        const read = await records.read(WORKSPACE, "cam", [LEAD])

        expect(read).toEqual({ leads: [], orders: new Map(), conversations: new Map(), zaloLeadIds: new Set() })
        expect(api.list).toHaveBeenCalledTimes(1)
        expect(api.list.mock.calls[0]?.[0]).toMatchObject({ from: "sales.lead", where: { op: "and" } })
    })
})

describe("InboxLeadsRecordsService assign", () => {
    it("writes the owner of a lead against the version it was read at", async () => {
        const { records, api } = await build()
        api.get.mockResolvedValueOnce(recordOf(LEAD, {}))
        api.update.mockResolvedValueOnce({ ok: true, row: recordOf(LEAD, {}), version: "4" })

        await records.assign(WORKSPACE, LEAD, AGENT)

        expect(api.update).toHaveBeenCalledWith("sales.lead", LEAD, "3", { owner: AGENT })
    })

    it("refuses a lead that is not there and a write the engine refuses", async () => {
        const { records, api } = await build()
        api.get.mockResolvedValueOnce(null)
        await expect(records.assign(WORKSPACE, LEAD, null)).rejects.toMatchObject({
            code: "INBOX_LEADS_LEAD_NOT_FOUND",
        })

        api.get.mockResolvedValueOnce(recordOf(LEAD, {}))
        const stale: EngineResult = { ok: false, reason: "stale" }
        api.update.mockResolvedValueOnce(stale)
        await expect(records.assign(WORKSPACE, LEAD, null)).rejects.toMatchObject({ code: "INBOX_LEADS_WRITE_REFUSED" })
    })
})
