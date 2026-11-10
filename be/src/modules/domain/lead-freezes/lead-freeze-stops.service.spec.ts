import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { queryProblems } from "@nivo-lite/agent-sdk/query"
import { agentRunStopEntity } from "@nivo-lite/blocks-core/entities"
import { AGENT_THREADS_OPTIONS } from "@modules/domain/agent-threads"
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

/** The catalog the entity engine validates every list against: the real `agent.run-stop` with its declared indexes. */
const CATALOG = new Map([[agentRunStopEntity.name, agentRunStopEntity]])

const build = async (workflows: ReadonlyArray<string> = ["chatbot.front-desk"]) => {
    const engine = mock<EntityEngineService>()
    wireScope(engine)
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFreezeStopsService,
            { provide: EntityEngineService, useValue: engine },
            { provide: AGENT_THREADS_OPTIONS, useValue: { workflows } },
        ],
    }).compile()
    return { service: moduleRef.get(LeadFreezeStopsService), engine }
}

/** Every list the reader sent, with what the real query validator finds wrong with it (an unindexed read fails here, not live). */
const problemsOf = (engine: ReturnType<typeof mock<EntityEngineService>>) =>
    engine.list.mock.calls.flatMap(([, query]) => queryProblems(query, CATALOG))

describe("LeadFreezeStopsService: the open stops a freeze reads", () => {
    it("reads the open stops of a customer by the lead's index and the open stops' index, merged once each", async () => {
        const { service, engine } = await build()
        engine.list
            .mockResolvedValueOnce(pageOf([OPEN_ROW]))
            .mockResolvedValueOnce(
                pageOf([OPEN_ROW, rowOf("stop-2", { ...OPEN_ROW.data, runId: "run-8", leadId: null }), rowOf("stop-3", { ...OPEN_ROW.data, runId: "run-9", leadId: null, conversationId: "c-2" })]),
            )

        const open = await service.openOfCustomer("ws-1", { leadId: "lead-1", conversationId: "c-1" })

        expect(open.map((stop) => stop.runId)).toEqual(["run-7", "run-8"])
        expect(open[0]).toEqual({
            runId: "run-7",
            stepKey: "consult",
            agentId: "chatbot",
            workflowId: "wf-front-desk",
            leadId: "lead-1",
            conversationId: "c-1",
            stoppedAt: "2026-11-10T10:00:00.000Z",
        })
        expect(engine.list.mock.calls.map(([, query]) => [query.where, query.order])).toEqual([
            [
                {
                    op: "and",
                    of: [
                        { op: "eq", field: "leadId", value: "lead-1" },
                        { op: "eq", field: "state", value: "open" },
                    ],
                },
                [["id", "asc"]],
            ],
            [
                { op: "eq", field: "state", value: "open" },
                [
                    ["stoppedAt", "desc"],
                    ["id", "desc"],
                ],
            ],
        ])
        expect(problemsOf(engine)).toEqual([])
    })

    it("reads the open stops of a run by the run's index, the state matched in code", async () => {
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
        expect(engine.list.mock.calls[0]?.[1].where).toEqual({ op: "eq", field: "runId", value: "run-7" })
        expect(problemsOf(engine)).toEqual([])
    })

    it("sends only indexed reads for a customer who names only a lead, or only a conversation, and none for neither", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValue(pageOf([]))

        await service.openOfCustomer("ws-1", { leadId: "lead-1", conversationId: null })
        await service.openOfCustomer("ws-1", { leadId: null, conversationId: "c-1" })
        await expect(service.openOfCustomer("ws-1", { leadId: null, conversationId: null })).resolves.toEqual([])

        expect(engine.list).toHaveBeenCalledTimes(2)
        expect(problemsOf(engine)).toEqual([])
    })

    it("is not engaged and reads nothing when no workflow runs on threads (the old engine's hot path)", async () => {
        const { service, engine } = await build([])

        expect(service.engaged()).toBe(false)
        await expect(service.openOfCustomer("ws-1", { leadId: "lead-1", conversationId: "c-1" })).resolves.toEqual([])
        await expect(service.openOfRun("ws-1", "run-7")).resolves.toEqual([])

        expect(engine.scoped).not.toHaveBeenCalled()
        expect(engine.list).not.toHaveBeenCalled()
    })

    it("proves the validator bites: the first shape (an `or` across lead and conversation, ordered by id) is refused", () => {
        const refused = queryProblems(
            {
                from: "agent.run-stop",
                select: ["runId"],
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
                order: [["id", "asc"]],
                page: { size: 50 },
            },
            CATALOG,
        )
        expect(refused).toEqual([expect.objectContaining({ code: "QUERY_NOT_INDEXED" })])
    })
})
