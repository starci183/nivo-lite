import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { FLOW_F_ENTITIES } from "@nivo-lite/blocks-core/entities"
import type { AggregateRow, ListPage } from "@nivo-lite/agent-sdk/entity/port"
import { queryProblems } from "@nivo-lite/agent-sdk/query"
import type { Aggregate, Query } from "@nivo-lite/agent-sdk/query"
import { EntityEngineService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { DashboardRecordsReadService } from "./dashboard-records-read.service"
import { windowOf } from "./policies/dashboard-period.policy"

const NOW = new Date("2026-11-09T05:00:00.000Z")
const CATALOG = new Map(FLOW_F_ENTITIES.map((entity) => [entity.name, entity]))

const row = (measures: AggregateRow["measures"], groups: AggregateRow["groups"] = {}): AggregateRow => ({
    groups,
    measures,
})

/** The engine double: it answers an aggregate by the entity it reads and keeps every tree it was asked. */
const build = async (
    answers: Readonly<Record<string, ReadonlyArray<AggregateRow>>>,
    pages: ReadonlyArray<ListPage>,
) => {
    const asked: Array<Aggregate | Query> = []
    const engine = mock<EntityEngineService>()
    engine.scoped.mockImplementation((_workspace, work) => work(mock<ScopedTx>()))
    engine.aggregate.mockImplementation((_tx, aggregate) => {
        asked.push(aggregate)
        const perDay = Object.keys(aggregate.measures).some((name) => name.startsWith("d"))
        const key = perDay ? `${aggregate.from}:days` : aggregate.from
        return Promise.resolve(answers[key] ?? [row({ count: 0 })])
    })
    const remaining = [...pages]
    engine.list.mockImplementation((_tx, query) => {
        asked.push(query)
        return Promise.resolve(remaining.shift() ?? { rows: [], next: null })
    })
    const moduleRef = await Test.createTestingModule({
        providers: [DashboardRecordsReadService, { provide: EntityEngineService, useValue: engine }],
    }).compile()
    return { service: moduleRef.get(DashboardRecordsReadService), engine, asked }
}

const orderPage = (
    orders: ReadonlyArray<{ amount: number; channel: string | null }>,
    next: string | null,
): ListPage => ({
    rows: orders.map((order, index) => ({
        row: {
            id: `o-${String(index)}`,
            workspaceId: "ws-1",
            version: "1",
            createdAt: "2026-11-09T01:00:00.000Z",
            updatedAt: "2026-11-09T01:00:00.000Z",
            data: { amountVnd: order.amount },
        },
        joined: { lead: order.channel === null ? null : { id: "l-1", data: { channel: order.channel } } },
        position: [],
        included: {},
    })),
    next,
})

describe("DashboardRecordsReadService > read", () => {
    const window = windowOf("last_7_days", NOW)

    it("asks only trees the entity catalog accepts", async () => {
        const { service, asked } = await build({}, [orderPage([], null)])

        await service.read("ws-1", window)

        expect(asked.length).toBeGreaterThan(0)
        for (const tree of asked) expect(queryProblems(tree, CATALOG)).toEqual([])
    })

    it("asks also for the thirty days of the longest period inside the bound of sixteen measures a statement", async () => {
        const { service, asked } = await build({}, [orderPage([], null)])

        await service.read("ws-1", windowOf("last_30_days", NOW))

        const perDay = asked.filter((tree): tree is Aggregate => "measures" in tree && "d0" in tree.measures)
        expect(perDay.map((tree) => Object.keys(tree.measures).length)).toEqual([16, 14, 16, 14])
        for (const tree of asked) expect(queryProblems(tree, CATALOG)).toEqual([])
    })

    it("reads revenue, orders and leads against the period before and sums the channels", async () => {
        const { service } = await build(
            {
                "payment.transaction": [row({ revenue: "3120000", previous: 2640000, count: 38 })],
                "sales.order": [row({ placed: 46, placedBefore: 37, paid: 41, paidBefore: 36 })],
                "sales.lead": [
                    row({ leads: 21, leadsBefore: 15, consulted: 18, consultedBefore: 13 }, { channel: "zalo" }),
                    row({ leads: 11, leadsBefore: 9, consulted: 7, consultedBefore: 8 }, { channel: "website" }),
                ],
                "chat.message": [row({ count: 527 })],
            },
            [orderPage([{ amount: 1_900_000, channel: "zalo" }], null)],
        )

        const facts = await service.read("ws-1", window)

        expect(facts.revenueVnd).toEqual({ current: 3_120_000, previous: 2_640_000 })
        expect(facts.matchedPayments).toBe(38)
        expect(facts.ordersPlaced).toEqual({ current: 46, previous: 37 })
        expect(facts.ordersPaid).toEqual({ current: 41, previous: 36 })
        expect(facts.leads).toEqual({ current: 32, previous: 24 })
        expect(facts.leadsConsulted).toEqual({ current: 25, previous: 21 })
        expect(facts.channels).toEqual([
            { channel: "zalo", leads: 21, revenueVnd: 1_900_000 },
            { channel: "website", leads: 11, revenueVnd: 0 },
        ])
        expect(facts.messagesAnswered).toBe(527)
    })
})

describe("DashboardRecordsReadService > days, channels and runs", () => {
    const window = windowOf("last_7_days", NOW)

    it("puts the per-day answers on the days of the window, a day with none at zero", async () => {
        const { service } = await build(
            {
                "payment.transaction:days": [row({ d0: 100_000, d6: "250000" })],
                "sales.order:days": [row({ d0: 3, d6: 5 })],
            },
            [],
        )

        const facts = await service.read("ws-1", window)

        expect(facts.days).toHaveLength(7)
        expect(facts.days[0]).toEqual({ day: "2026-11-03", revenueVnd: 100_000, orders: 3 })
        expect(facts.days[1]).toEqual({ day: "2026-11-04", revenueVnd: 0, orders: 0 })
        expect(facts.days[6]).toEqual({ day: "2026-11-09", revenueVnd: 250_000, orders: 5 })
    })

    it("reads the paid orders in as many pages as the cap allows and counts an order without a lead to no channel", async () => {
        const full = Array.from({ length: 2 }, () => ({ amount: 100, channel: "zalo" }))
        const { service, engine } = await build({ "sales.lead": [] }, [
            orderPage(full, "c1"),
            orderPage([{ amount: 50, channel: null }], "c2"),
            orderPage([{ amount: 25, channel: "zalo" }], null),
        ])

        const facts = await service.read("ws-1", window)

        expect(engine.list).toHaveBeenCalledTimes(3)
        expect(facts.channels).toEqual([{ channel: "zalo", leads: 0, revenueVnd: 225 }])
    })

    it("counts the failed runs per agent", async () => {
        const { service } = await build({ "agent.run": [row({ count: 2 }, { agentId: "a-1" })] }, [])

        const facts = await service.read("ws-1", window)

        expect([...facts.failedRunsByAgent]).toEqual([["a-1", 2]])
    })
})
