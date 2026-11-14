import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { AGENT_TURN_QUEUE_PRODUCER, type AgentTurnQueue } from "@modules/queues/agent-turn"
import { AgentWakeService, WAITING_REASON, handedBackOf } from "./agent-wake.service"
import type { AgentWakeContext } from "./agent-work.contracts"
import { AgentWakeEntity } from "./persistence/entities"


/** A query builder that records its update: the table, the values set, the where text and its params; it answers `affected`. */
const updateBuilderOf = (affected: number) => {
    const seen: { entity?: unknown; set?: Record<string, unknown>; where?: string; params?: Record<string, unknown> } = {}
    const builder = {
        update: (entity: unknown) => ((seen.entity = entity), builder),
        set: (values: Record<string, unknown>) => ((seen.set = values), builder),
        where: (text: string, params: Record<string, unknown>) => ((seen.where = text), (seen.params = params), builder),
        execute: () => Promise.resolve({ affected, raw: [], generatedMaps: [] }),
    }
    return { builder, seen }
}

const WS = "ws-1"

/** A stored wake row as the table holds it. */
const rowOf = (id: string, values: Partial<AgentWakeEntity> = {}): AgentWakeEntity =>
    Object.assign(new AgentWakeEntity(), {
        id,
        workspaceId: WS,
        agentId: "agent-1",
        source: "trigger",
        eventKey: `nivo.trigger.zalo.message.received:acc-1:${id}`,
        scopeKey: "key:routeId=route-1",
        status: "held",
        reason: `${WAITING_REASON}run-1`,
        context: {},
        createdAt: new Date("2026-11-14T00:00:00.000Z"),
        ...values,
    })

const build = async () => {
    const queue = mock<AgentTurnQueue>()
    const container = await Test.createTestingModule({
        providers: [
            AgentWakeService,
            { provide: AGENT_TURN_QUEUE_PRODUCER, useValue: queue },
            { provide: LOGGER, useValue: mock<Logger>() },
        ],
    }).compile()
    const tx = mockEntityManager()
    tx.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] })
    return { service: container.get(AgentWakeService), queue, tx }
}

describe("AgentWakeService: the events waiting behind a run (one run in flight per graph and subject)", () => {
    it("`run.waiting` counts the wakes held `waiting:<run>` of that run only", async () => {
        const { service, tx } = await build()
        tx.count.mockResolvedValue(3)

        await expect(service.waitingCountOf(tx, WS, "run-1")).resolves.toBe(3)
        expect(tx.count).toHaveBeenCalledWith(AgentWakeEntity, { where: { workspaceId: WS, status: "held", reason: `${WAITING_REASON}run-1` } })
    })

    it("when the run has ended, every held wake is pending again IN THE ORDER IT CAME, each with its drain job (the next run takes the list)", async () => {
        const { service, tx, queue } = await build()
        tx.find.mockResolvedValue([rowOf("w-1"), rowOf("w-2"), rowOf("w-3")])

        await expect(service.releaseWaiting(tx, WS, "run-1")).resolves.toBe(3)

        expect(tx.find).toHaveBeenCalledWith(AgentWakeEntity, {
            where: { workspaceId: WS, status: "held", reason: `${WAITING_REASON}run-1` },
            order: { createdAt: "ASC" },
        })
        expect(tx.update.mock.calls.map(([, where]) => (where as { id: string }).id)).toEqual(["w-1", "w-2", "w-3"])
        expect(tx.update.mock.calls[0]?.[2]).toMatchObject({ status: "pending", reason: null })
        // DEF-5: a FRESH drain job per released wake. The wake's first job holds its fact's key for ever (`job_outbox.dedupe_key` UNIQUE):
        // writing that key again (`enqueueDrain` with the event key) wrote no job and the wake waited for the minute sweep.
        expect(queue.enqueueDrain).not.toHaveBeenCalled()
        expect(queue.enqueueAgainDrain.mock.calls).toEqual([
            [{ workspaceId: WS, agentId: "agent-1", scopeKey: "key:routeId=route-1" }, tx],
            [{ workspaceId: WS, agentId: "agent-1", scopeKey: "key:routeId=route-1" }, tx],
            [{ workspaceId: WS, agentId: "agent-1", scopeKey: "key:routeId=route-1" }, tx],
        ])
    })

    // DEF-5 (MX P-07b): the call wake held behind the sale run was released at each park of the run (`offerToWait`) and held again: `begin`
    // counts every begin, so after three parks it was dead `attempts` before it ever ran. Waiting behind a run is no failed try.
    it("a released wake starts its tries from zero again: waiting behind a run is no failed try", async () => {
        const { service, tx } = await build()
        tx.find.mockResolvedValue([rowOf("w-1", { attempts: 3, maxAttempts: 3 })])

        await service.releaseWaiting(tx, WS, "run-1")

        expect(tx.update).toHaveBeenCalledWith(
            AgentWakeEntity,
            { id: "w-1", status: "held" },
            expect.objectContaining({ status: "pending", reason: null, attempts: 0 }),
        )
    })
})

describe("AgentWakeService.reoffer: a run hands back the event its wait took", () => {
    const event = { source: "trigger", eventKey: "nivo.trigger.zalo.message.received:acc-1:m-9", reason: "wait_took" }

    it("every wake of the event a wait took (one per agent) is pending again, names the run that handed it back, and drains again", async () => {
        const { service, tx, queue } = await build()
        tx.find.mockResolvedValue([
            rowOf("w-chatbot", { agentId: "agent-chatbot", status: "done", reason: "wait_took", eventKey: event.eventKey }),
            rowOf("w-sales", { agentId: "agent-sales", status: "done", reason: "wait_took", eventKey: event.eventKey }),
        ])

        await expect(service.reoffer(tx, WS, event, "run-sale")).resolves.toBe(2)

        expect(tx.find).toHaveBeenCalledWith(AgentWakeEntity, {
            where: { workspaceId: WS, source: "trigger", eventKey: event.eventKey, status: "done", reason: "wait_took" },
            order: { createdAt: "ASC" },
        })
        const [, where, values] = tx.update.mock.calls[0] ?? []
        expect(where).toEqual({ id: "w-chatbot", status: "done", reason: "wait_took" })
        expect(values).toMatchObject({ status: "pending", reason: null, attempts: 0, finishedAt: null })
        expect(handedBackOf((values as { context: AgentWakeContext }).context)).toEqual(["run-sale"])
        // DEF-5: each re-offered wake drains NOW on a job of its own (the event key's job already exists: the same key wrote none and the
        // handed-back line waited ~90 s for the minute sweep).
        expect(queue.enqueueDrain).not.toHaveBeenCalled()
        expect(queue.enqueueAgainDrain.mock.calls).toEqual([
            [{ workspaceId: WS, agentId: "agent-chatbot", scopeKey: "key:routeId=route-1" }, tx],
            [{ workspaceId: WS, agentId: "agent-sales", scopeKey: "key:routeId=route-1" }, tx],
        ])
    })

    it("offers it to each run at most once: a wake this run already handed back is left as it is (a replay changes nothing)", async () => {
        const { service, tx, queue } = await build()
        tx.find.mockResolvedValue([
            rowOf("w-1", { status: "done", reason: "wait_took", context: { handedBackJson: JSON.stringify(["run-sale"]) } }),
        ])

        await expect(service.reoffer(tx, WS, event, "run-sale")).resolves.toBe(0)
        expect(tx.update).not.toHaveBeenCalled()
        expect(queue.enqueueAgainDrain).not.toHaveBeenCalled()
    })

    it("a second hand-back of the same event by ANOTHER run adds that run to the list", async () => {
        const { service, tx } = await build()
        tx.find.mockResolvedValue([
            rowOf("w-1", { status: "done", reason: "wait_took", context: { handedBackJson: JSON.stringify(["run-a"]) } }),
        ])

        await service.reoffer(tx, WS, event, "run-b")

        const values = tx.update.mock.calls[0]?.[2] as { context: AgentWakeContext }
        expect(handedBackOf(values.context)).toEqual(["run-a", "run-b"])
    })
})

describe("AgentWakeService.dropOfScopes (R72 Q1: erasing a subject drops the events of it no run took yet)", () => {
    it("every pending or held wake of any agent in the subject scopes is skipped with the reason; a running one is left to its drive", async () => {
        const { service } = await build()
        const { builder, seen } = updateBuilderOf(3)
        const tx = mockEntityManager()
        tx.createQueryBuilder.mockReturnValue(builder as never)

        await expect(service.dropOfScopes(tx, WS, ["key:contactId=c-1", "key:routeId=route-1"], "subject_erased")).resolves.toBe(3)

        expect(seen.entity).toBe(AgentWakeEntity)
        expect(seen.set).toMatchObject({ status: "skipped", reason: "subject_erased" })
        expect(seen.where).toBe("workspace_id = :workspaceId AND status IN ('pending', 'held') AND scope_key IN (:...scopeKeys)")
        expect(seen.params).toEqual({ workspaceId: WS, scopeKeys: ["key:contactId=c-1", "key:routeId=route-1"] })
    })

    it("writes nothing for no scope", async () => {
        const { service } = await build()
        const tx = mockEntityManager()

        await expect(service.dropOfScopes(tx, WS, [], "subject_erased")).resolves.toBe(0)
        expect(tx.createQueryBuilder).not.toHaveBeenCalled()
    })
})
