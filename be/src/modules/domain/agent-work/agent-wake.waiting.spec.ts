import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { AGENT_TURN_QUEUE_PRODUCER, type AgentTurnQueue } from "@modules/queues/agent-turn"
import { AgentWakeService, WAITING_REASON, handedBackOf } from "./agent-wake.service"
import type { AgentWakeContext } from "./agent-work.contracts"
import { AgentWakeEntity } from "./persistence/entities"

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
        expect(queue.enqueueDrain.mock.calls.map(([, , eventKey]) => eventKey)).toEqual([
            "nivo.trigger.zalo.message.received:acc-1:w-1",
            "nivo.trigger.zalo.message.received:acc-1:w-2",
            "nivo.trigger.zalo.message.received:acc-1:w-3",
        ])
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
        expect(queue.enqueueDrain).toHaveBeenCalledTimes(2)
    })

    it("offers it to each run at most once: a wake this run already handed back is left as it is (a replay changes nothing)", async () => {
        const { service, tx, queue } = await build()
        tx.find.mockResolvedValue([
            rowOf("w-1", { status: "done", reason: "wait_took", context: { handedBackJson: JSON.stringify(["run-sale"]) } }),
        ])

        await expect(service.reoffer(tx, WS, event, "run-sale")).resolves.toBe(0)
        expect(tx.update).not.toHaveBeenCalled()
        expect(queue.enqueueDrain).not.toHaveBeenCalled()
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
