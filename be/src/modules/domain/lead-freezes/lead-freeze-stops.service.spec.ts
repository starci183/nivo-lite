import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { EntityEngineService } from "@modules/domain/entity-engine"
import { pageOf, wireScope } from "@tests/fixtures/builders/agent-graph-records.builder"
import { LeadFreezeStopsService } from "./lead-freeze-stops.service"

const rowOf = (id: string, data: RecordRow["data"]): RecordRow => ({
    id,
    workspaceId: "ws-1",
    version: "2",
    createdAt: "2026-11-10T09:59:00.000Z",
    updatedAt: "2026-11-10T10:00:00.000Z",
    data,
})

const OPEN_ROW = rowOf("stop-1", {
    runId: "run-7",
    stepKey: "consult",
    agentId: "chatbot",
    workflowId: "wf-front-desk",
    leadId: "lead-1",
    conversationId: "c-1",
    state: "open",
    stoppedAt: "2026-11-10T10:00:00.000Z",
})

const build = async () => {
    const engine = mock<EntityEngineService>()
    wireScope(engine)
    const moduleRef = await Test.createTestingModule({
        providers: [LeadFreezeStopsService, { provide: EntityEngineService, useValue: engine }],
    }).compile()
    return { service: moduleRef.get(LeadFreezeStopsService), engine }
}

describe("LeadFreezeStopsService: the open stops a freeze reads", () => {
    it("reads the open stops of a customer by their lead or their conversation, in one bounded page", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValue(pageOf([OPEN_ROW]))

        await expect(service.openOfCustomer("ws-1", { leadId: "lead-1", conversationId: "c-1" })).resolves.toEqual([
            {
                runId: "run-7",
                stepKey: "consult",
                agentId: "chatbot",
                workflowId: "wf-front-desk",
                leadId: "lead-1",
                conversationId: "c-1",
                stoppedAt: "2026-11-10T10:00:00.000Z",
            },
        ])
        expect(engine.list.mock.calls[0]?.[1]).toMatchObject({
            from: "agent.run-stop",
            where: {
                op: "and",
                of: [
                    { op: "eq", field: "state", value: "open" },
                    {
                        op: "or",
                        of: [
                            { op: "eq", field: "leadId", value: "lead-1" },
                            { op: "eq", field: "conversationId", value: "c-1" },
                        ],
                    },
                ],
            },
            page: { size: 50 },
        })
    })

    it("asks by the one thing a customer names, and reads nothing for a customer that names nothing", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValue(pageOf([]))

        await service.openOfCustomer("ws-1", { leadId: null, conversationId: "c-1" })
        await expect(service.openOfCustomer("ws-1", { leadId: null, conversationId: null })).resolves.toEqual([])

        expect(engine.list).toHaveBeenCalledTimes(1)
        expect(engine.list.mock.calls[0]?.[1].where).toEqual({
            op: "and",
            of: [
                { op: "eq", field: "state", value: "open" },
                { op: "eq", field: "conversationId", value: "c-1" },
            ],
        })
    })

    it("reads the open stops of a run, and drops a row that is resolved or names no run, step or agent", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValue(
            pageOf([
                OPEN_ROW,
                rowOf("stop-2", { ...OPEN_ROW.data, stepKey: "match", state: "resolved" }),
                rowOf("stop-3", { ...OPEN_ROW.data, agentId: null }),
                rowOf("stop-4", { ...OPEN_ROW.data, stepKey: "close", stoppedAt: null }),
            ]),
        )

        const open = await service.openOfRun("ws-1", "run-7")

        expect(open.map((stop) => stop.stepKey)).toEqual(["consult", "close"])
        expect(open[1]?.stoppedAt).toBe("2026-11-10T09:59:00.000Z")
        expect(engine.list.mock.calls[0]?.[1].where).toEqual({
            op: "and",
            of: [
                { op: "eq", field: "runId", value: "run-7" },
                { op: "eq", field: "state", value: "open" },
            ],
        })
    })
})
