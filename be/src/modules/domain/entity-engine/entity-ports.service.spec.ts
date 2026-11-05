import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { ModuleJobsQueue } from "@modules/queues/module-jobs"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { JobDefinition } from "@nivo-lite/agent-sdk/mutation"
import type { Aggregate, Query } from "@nivo-lite/agent-sdk/query"
import type { RunIn } from "./entity-engine.contracts"
import { ENTITY_ENGINE_OPTIONS } from "./entity-engine.decorators"
import type { EntityEngineOptions } from "./entity-engine.options"
import { EntityEngineService } from "./entity-engine.service"
import { EntityMutationService } from "./entity-mutation.service"
import { EntityPortsService } from "./entity-ports.service"
import { listScopeOf } from "./entity-port.policy"
import { EntityEngineErrorCode } from "./errors/entity-engine.error"
import { mintScopedTx } from "./policies/scoped-tx.policy"

type ParseFailure = Extract<ReturnType<JobDefinition["input"]["safeParse"]>, { success: false }>["error"]

const WS = "11111111-1111-4111-8111-111111111111"
const TX = mintScopedTx({ manager: mockEntityManager(), workspaceId: WS })
const RUN_IN: RunIn = (use) => use(TX)
const MISSING = { ok: false, reason: "missing" } as const

const LEAD: EntityDefinition = {
    entry: "entity",
    name: "sales.lead",
    dataKind: "sales-lead",
    fields: { contactName: { kind: "text", nullable: false, maxLength: 200 } },
}

const build = async () => {
    const engine = mock<EntityEngineService>()
    const mutations = mock<EntityMutationService>()
    const queue = mock<ModuleJobsQueue>()
    const input = mock<JobDefinition["input"]>()
    const job = mock<JobDefinition>({ name: "sales.confirmNotice", input })
    const moduleRef = await Test.createTestingModule({
        providers: [
            EntityPortsService,
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityMutationService, useValue: mutations },
            { provide: ModuleJobsQueue, useValue: queue },
            {
                provide: ENTITY_ENGINE_OPTIONS,
                useValue: builder<EntityEngineOptions>({
                    entities: [LEAD],
                    jobs: [job],
                    cursorKey: new Secret("a2V5"),
                })(),
            },
        ],
    }).compile()
    return { ports: moduleRef.get(EntityPortsService), engine, mutations, queue, job, input }
}

describe("EntityPortsService reads", () => {
    it("reads through the engine in the scope the port is bound to", async () => {
        const { ports, engine } = await build()
        const api = ports.entitiesApi(RUN_IN, "action")
        const query: Query = { from: "sales.lead", select: ["contactName"], order: [["id", "asc"]], page: { size: 5 } }
        const aggregate: Aggregate = { from: "sales.lead", measures: { n: { kind: "count" } }, limit: 3 }
        engine.get.mockResolvedValue(null)
        engine.list.mockResolvedValue({ rows: [], next: null })
        engine.aggregate.mockResolvedValue([])

        await expect(api.get("sales.lead", "id-1")).resolves.toBeNull()
        await expect(api.list(query)).resolves.toEqual({ rows: [], next: null })
        await expect(api.aggregate(aggregate)).resolves.toEqual([])

        expect(engine.get).toHaveBeenCalledWith(TX, "sales.lead", "id-1")
        expect(engine.list).toHaveBeenCalledWith(TX, query, listScopeOf(query))
        expect(engine.aggregate).toHaveBeenCalledWith(TX, aggregate)
    })
})

describe("EntityPortsService writes", () => {
    it("writes through the mutation service as the actor the port was bound for", async () => {
        const { ports, mutations } = await build()
        const api = ports.entitiesApi(RUN_IN, "job")
        mutations.mutate.mockResolvedValue(MISSING)

        await api.insert("sales.lead", { contactName: "An" })
        await api.insert("sales.lead", { contactName: "An" }, { owner: "id-2" })
        await api.update("sales.lead", "id-1", "3", { contactName: "Binh" })
        await api.upsert("sales.lead", "phone_taken", { phone: "0900" })
        await api.ensure("sales.lead", "byPhone", { phone: "0900" })
        await api.delete("sales.lead", "id-1")
        await api.delete("sales.lead", "id-1", "3")
        await api.link("sales.lead", "id-1", "owner", "id-2")
        await api.unlink("sales.lead", "id-1", "owner", "id-2")

        expect(mutations.mutate.mock.calls).toEqual([
            [TX, { op: "insert", entity: "sales.lead", values: { contactName: "An" } }, "job"],
            [
                TX,
                { op: "insert", entity: "sales.lead", values: { contactName: "An" }, links: { owner: "id-2" } },
                "job",
            ],
            [
                TX,
                { op: "update", entity: "sales.lead", key: "id-1", expected: "3", values: { contactName: "Binh" } },
                "job",
            ],
            [TX, { op: "upsert", entity: "sales.lead", on: "phone_taken", values: { phone: "0900" } }, "job"],
            [TX, { op: "ensure", entity: "sales.lead", match: "byPhone", values: { phone: "0900" } }, "job"],
            [TX, { op: "delete", entity: "sales.lead", key: "id-1" }, "job"],
            [TX, { op: "delete", entity: "sales.lead", key: "id-1", expected: "3" }, "job"],
            [TX, { op: "link", entity: "sales.lead", key: "id-1", relation: "owner", to: "id-2" }, "job"],
            [TX, { op: "unlink", entity: "sales.lead", key: "id-1", relation: "owner", to: "id-2" }, "job"],
        ])
    })
})

describe("EntityPortsService outboxApi", () => {
    it("validates the input of a declared job and writes it to the queue outbox in the scope's transaction", async () => {
        const { ports, queue, job, input } = await build()
        input.safeParse.mockReturnValue({ success: true, data: { orderId: "o-1" } })

        await ports.outboxApi(RUN_IN).enqueue(job, { orderId: "o-1" }, { dedupeKey: "o-1", delayMs: 500 })

        expect(queue.enqueue).toHaveBeenCalledWith(
            { workspaceId: WS, job: "sales.confirmNotice", input: { orderId: "o-1" } },
            TX.manager,
            { dedupeKey: "sales.confirmNotice:o-1", delayMs: 500 },
        )
    })

    it("lets the queue mint the identity of a job enqueued with no options", async () => {
        const { ports, queue, job, input } = await build()
        input.safeParse.mockReturnValue({ success: true, data: { orderId: "o-1" } })

        await ports.outboxApi(RUN_IN).enqueue(job, { orderId: "o-1" })

        expect(queue.enqueue).toHaveBeenCalledWith(
            { workspaceId: WS, job: "sales.confirmNotice", input: { orderId: "o-1" } },
            TX.manager,
            { dedupeKey: undefined, delayMs: undefined },
        )
    })

    it("refuses a job no module declares", async () => {
        const { ports, queue } = await build()
        const other = mock<JobDefinition>({ name: "sales.other", input: mock<JobDefinition["input"]>() })

        await expect(ports.outboxApi(RUN_IN).enqueue(other, {})).rejects.toMatchObject({
            code: EntityEngineErrorCode.JobUnknown,
            params: { job: "sales.other" },
        })
        expect(queue.enqueue).not.toHaveBeenCalled()
    })

    it("refuses an input the job's declaration rejects", async () => {
        const { ports, queue, job, input } = await build()
        input.safeParse.mockReturnValue({ success: false, error: mock<ParseFailure>() })

        await expect(ports.outboxApi(RUN_IN).enqueue(job, { orderId: 5 })).rejects.toMatchObject({
            code: EntityEngineErrorCode.JobInputInvalid,
            params: { job: "sales.confirmNotice" },
        })
        expect(queue.enqueue).not.toHaveBeenCalled()
    })
})

describe("EntityPortsService portsFor", () => {
    it("provides the handle of each port by the name the caller gave it", async () => {
        const { ports, engine } = await build()
        engine.definition.mockReturnValue(LEAD)

        const provided = ports.portsFor(RUN_IN, "action", {
            everything: { entry: "port", id: "engine.entities" },
            leads: { entry: "port", id: "engine.entity.sales.lead" },
            outbox: { entry: "port", id: "engine.outbox" },
        })

        expect(Object.keys(provided)).toEqual(["everything", "leads", "outbox"])
        expect(provided.everything).toHaveProperty("insert")
        expect(provided.leads).toHaveProperty("ensure")
        expect(provided.outbox).toHaveProperty("enqueue")
        expect(engine.definition).toHaveBeenCalledWith("sales.lead")
    })

    it("refuses a port the engine does not provide", async () => {
        const { ports } = await build()

        expect(() => ports.portsFor(RUN_IN, "job", { door: { entry: "port", id: "engine.door" } })).toThrow(
            EntityEngineErrorCode.PortUnprovided,
        )
    })
})
