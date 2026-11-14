import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentRunRecordsService, type RunCount, type RunCountFilter } from "@modules/domain/agent-runs"
import { ContactsService } from "@modules/domain/contacts"
import { ChannelDeliveriesService } from "@modules/domain/customer-routes"
import { EntityEngineService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { DashboardRecordsReadService } from "./dashboard-records-read.service"
import { windowOf } from "./policies/dashboard-period.policy"

const NOW = new Date("2026-11-09T05:00:00.000Z")

/** The runs of a period and of the period before it, by agent and status, as the runs table counts them. */
interface RunGroups {
    readonly now: ReadonlyArray<RunCount>
    readonly before: ReadonlyArray<RunCount>
}

/** What the engine's stores count for the period and for the one before it. */
interface Figures {
    /** Routes told something, now and before. */
    readonly routes: readonly [number, number]
    /** People created, now and before. */
    readonly contacts: readonly [number, number]
    /** Messages delivered in the period. */
    readonly delivered: number
}

const NO_FIGURES: Figures = { routes: [0, 0], contacts: [0, 0], delivered: 0 }

/**
 * The service over the engine's own stores (each count answers by the period it is asked for: the period, or the one before it) and an
 * engine double; the runs double answers the count of a period by its start and keeps every filter it was asked.
 */
const build = async (figures: Figures = NO_FIGURES, runs: RunGroups = { now: [], before: [] }) => {
    const counted: Array<RunCountFilter> = []
    const engine = mock<EntityEngineService>()
    engine.scoped.mockImplementation((_workspace, work) => work(mock<ScopedTx>()))
    const runRows = mock<AgentRunRecordsService>()
    runRows.runCounts.mockImplementation((_tx, filter) => {
        counted.push(filter)
        return Promise.resolve(filter.started?.to === window.from.toISOString() ? runs.before : runs.now)
    })
    const pick = (pair: readonly [number, number], from: Date): number => (from.getTime() === window.from.getTime() ? pair[0] : pair[1])
    const contacts = mock<ContactsService>()
    contacts.countCreated.mockImplementation((_ws, from) => Promise.resolve(pick(figures.contacts, from)))
    const deliveries = mock<ChannelDeliveriesService>()
    deliveries.routesTold.mockImplementation((_ws, from) => Promise.resolve(pick(figures.routes, from)))
    deliveries.countDelivered.mockResolvedValue(figures.delivered)
    const moduleRef = await Test.createTestingModule({
        providers: [
            DashboardRecordsReadService,
            { provide: EntityEngineService, useValue: engine },
            { provide: AgentRunRecordsService, useValue: runRows },
            { provide: ContactsService, useValue: contacts },
            { provide: ChannelDeliveriesService, useValue: deliveries },
        ],
    }).compile()
    return { service: moduleRef.get(DashboardRecordsReadService), counted, contacts, deliveries }
}

const window = windowOf("last_7_days", NOW, "Asia/Ho_Chi_Minh")

const counts = (agentId: string, done: number, failed: number): ReadonlyArray<RunCount> => [
    { agentId, status: "done", count: done },
    { agentId, status: "failed", count: failed },
]

describe("DashboardRecordsReadService > read", () => {
    it("asks the engine's stores for the window and the one before it, and counts the runs of both", async () => {
        const { service, counted, contacts, deliveries } = await build()

        await service.read("ws-1", window)

        expect(contacts.countCreated).toHaveBeenCalledWith("ws-1", window.from, window.to)
        expect(contacts.countCreated).toHaveBeenCalledWith("ws-1", window.previousFrom, window.from)
        expect(deliveries.routesTold).toHaveBeenCalledWith("ws-1", window.from, window.to)
        expect(deliveries.routesTold).toHaveBeenCalledWith("ws-1", window.previousFrom, window.from)
        expect(deliveries.countDelivered).toHaveBeenCalledWith("ws-1", window.from, window.to)
        const statuses = ["done", "compensated", "failed", "dead"]
        expect(counted).toEqual([
            { statuses, started: { from: window.from.toISOString(), to: window.to.toISOString() } },
            { statuses, started: { from: window.previousFrom.toISOString(), to: window.from.toISOString() } },
        ])
    })

    it("reads conversations (the routes the shop answered on) and new contacts against the period before", async () => {
        const { service } = await build({ ...NO_FIGURES, routes: [210, 180], contacts: [40, 25] })

        const facts = await service.read("ws-1", window)

        expect(facts.conversations).toEqual({ current: 210, previous: 180 })
        expect(facts.newContacts).toEqual({ current: 40, previous: 25 })
    })

    it("counts the messages delivered in the period as the answered ones", async () => {
        const { service } = await build({ ...NO_FIGURES, delivered: 527 })

        const facts = await service.read("ws-1", window)

        expect(facts.messagesAnswered).toBe(527)
    })

    it("reads no figure of a workspace with no contact and no delivery, the runs still counted", async () => {
        const { service } = await build(NO_FIGURES, { now: [{ agentId: "a-1", status: "done", count: 3 }], before: [] })

        const facts = await service.read("ws-1", window)

        expect(facts.conversations).toEqual({ current: 0, previous: 0 })
        expect(facts.newContacts).toEqual({ current: 0, previous: 0 })
        expect(facts.messagesAnswered).toBe(0)
        expect(facts.runsDone).toEqual({ current: 3, previous: 0 })
    })
})

describe("DashboardRecordsReadService > runs", () => {
    it("sums the finished and failed runs over the agents, now and before", async () => {
        const { service } = await build(NO_FIGURES, {
            now: [...counts("a-1", 10, 2), ...counts("a-2", 5, 0), ...counts("a-3", 1, 1)],
            before: [...counts("a-1", 8, 1), ...counts("a-2", 4, 3), ...counts("a-3", 0, 0)],
        })

        const facts = await service.read("ws-1", window)

        expect(facts.runsDone).toEqual({ current: 16, previous: 12 })
        expect(facts.runsFailed).toEqual({ current: 3, previous: 4 })
    })

    it("counts the failed runs per agent, leaving out an agent with none", async () => {
        const { service } = await build(NO_FIGURES, { now: [...counts("a-1", 10, 2), ...counts("a-2", 5, 0)], before: [] })

        const facts = await service.read("ws-1", window)

        expect([...facts.failedRunsByAgent]).toEqual([["a-1", 2]])
    })
})
