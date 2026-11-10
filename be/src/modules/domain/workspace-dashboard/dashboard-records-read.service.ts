import { Injectable } from "@nestjs/common"
import { EntityEngineService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import type { AggregateRow } from "@nivo-lite/agent-sdk/entity/port"
import type { Aggregate, FilterExpr } from "@nivo-lite/agent-sdk/query"
import { eachInOrder } from "@modules/platform/primitives"
import type {
    Compared,
    DashboardDay,
    DashboardWindow,
    DayFacts,
    PerDayFigure,
    RecordsFacts,
} from "./workspace-dashboard.contracts"
import { chunksOf } from "./policies/dashboard-period.policy"
import { channelsOf, comparedOf, numberOf } from "./policies/dashboard-facts.policy"

const PAYMENT = "payment.transaction"
const ORDER = "sales.order"
const LEAD = "sales.lead"
const MESSAGE = "chat.message"
const RUN = "agent.run"

/** The most per-day measures one statement holds (the engine's own bound is sixteen measures). */
const DAYS_PER_STATEMENT = 16

/** The statuses of an order that was placed: the customer's order stood, whether or not it is paid. */
const PLACED_STATUSES = ["confirmed", "invoiced", "paid"] as const

/** The statuses of a run that failed or was handed to a person. */
const FAILED_RUN_STATUSES = ["failed", "dead"] as const

/** The most paid orders weighed to attribute revenue to a channel: five pages of the newest. */
const CHANNEL_ORDER_PAGES = 5
const PAGE_SIZE = 100

/** The most channels, agents or groups one statement returns. */
const GROUP_LIMIT = 100

const eq = (field: string, value: string): FilterExpr => ({ op: "eq", field, value })
const inSet = (field: string, values: ReadonlyArray<string>): FilterExpr => ({ op: "in", field, values })
const from = (field: string, at: Date): FilterExpr => ({ op: "gte", field, value: at.toISOString() })
const before = (field: string, at: Date): FilterExpr => ({ op: "lt", field, value: at.toISOString() })
const all = (...of: ReadonlyArray<FilterExpr>): FilterExpr => ({ op: "and", of })
const within = (field: string, start: Date, end: Date): FilterExpr => all(from(field, start), before(field, end))

const firstOf = (rows: ReadonlyArray<AggregateRow>): AggregateRow["measures"] => rows[0]?.measures ?? {}

@Injectable()
/**
 * What the records say about a period, read through the entity engine in one workspace scope: payments, orders, leads and replies as
 * grouped aggregates (a statement per entity, each figure a `FILTER` measure), the days of the chart as per-day measures in Vietnam
 * time, and the revenue of each channel from the newest paid orders joined to their lead. Nothing here loops per row.
 */
export class DashboardRecordsReadService {
    constructor(private readonly engine: EntityEngineService) {}

    /** Reads every figure of the window in one scope. */
    read(workspaceId: string, window: DashboardWindow): Promise<RecordsFacts> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const payments = await this.payments(tx, window)
            const orders = await this.orders(tx, window)
            const leads = await this.leads(tx, window)
            const channelRevenue = await this.channelRevenue(tx, window)
            const revenueByDay = await this.perDay(tx, PAYMENT, "occurredAt", window.days, {
                kind: "sum",
                field: "amountVnd",
                base: [eq("direction", "credit"), eq("status", "matched")],
            })
            const ordersByDay = await this.perDay(tx, ORDER, "createdAt", window.days, {
                kind: "count",
                base: [inSet("status", PLACED_STATUSES)],
            })
            return {
                revenueVnd: payments.revenue,
                matchedPayments: payments.count,
                ordersPlaced: orders.placed,
                ordersPaid: orders.paid,
                leads: leads.leads,
                leadsConsulted: leads.consulted,
                channels: channelsOf(leads.byChannel, channelRevenue),
                days: window.days.map((day): DayFacts => ({
                    day: day.day,
                    revenueVnd: revenueByDay.get(day.day) ?? 0,
                    orders: ordersByDay.get(day.day) ?? 0,
                })),
                messagesAnswered: await this.messagesAnswered(tx, window),
                failedRunsByAgent: await this.failedRuns(tx, window),
            }
        })
    }

    /** Matched credits: the sum in the period and before it, and how many arrived in the period. */
    private async payments(tx: ScopedTx, window: DashboardWindow): Promise<{ revenue: Compared; count: number }> {
        const measures = firstOf(
            await this.engine.aggregate(tx, {
                from: PAYMENT,
                where: all(
                    eq("direction", "credit"),
                    eq("status", "matched"),
                    within("occurredAt", window.previousFrom, window.to),
                ),
                measures: {
                    revenue: { kind: "sum", field: "amountVnd", where: from("occurredAt", window.from) },
                    previous: { kind: "sum", field: "amountVnd", where: before("occurredAt", window.from) },
                    count: { kind: "count", where: from("occurredAt", window.from) },
                },
                limit: 1,
            }),
        )
        return { revenue: comparedOf(measures.revenue, measures.previous), count: numberOf(measures.count) }
    }

    /** Orders placed, and of them the paid ones, in the period and before it. */
    private async orders(tx: ScopedTx, window: DashboardWindow): Promise<{ placed: Compared; paid: Compared }> {
        const placed = inSet("status", PLACED_STATUSES)
        const measures = firstOf(
            await this.engine.aggregate(tx, {
                from: ORDER,
                where: all(placed, within("createdAt", window.previousFrom, window.to)),
                measures: {
                    placed: { kind: "count", where: from("createdAt", window.from) },
                    placedBefore: { kind: "count", where: before("createdAt", window.from) },
                    paid: { kind: "count", where: all(eq("status", "paid"), from("createdAt", window.from)) },
                    paidBefore: { kind: "count", where: all(eq("status", "paid"), before("createdAt", window.from)) },
                },
                limit: 1,
            }),
        )
        return {
            placed: comparedOf(measures.placed, measures.placedBefore),
            paid: comparedOf(measures.paid, measures.paidBefore),
        }
    }

    /** Leads created, per channel, and of them the ones taken beyond the first stage, in the period and before it. */
    private async leads(
        tx: ScopedTx,
        window: DashboardWindow,
    ): Promise<{ leads: Compared; consulted: Compared; byChannel: ReadonlyMap<string, number> }> {
        const advanced: FilterExpr = { op: "ne", field: "stage", value: "new" }
        const rows = await this.engine.aggregate(tx, {
            from: LEAD,
            where: within("createdAt", window.previousFrom, window.to),
            groupBy: ["channel"],
            measures: {
                leads: { kind: "count", where: from("createdAt", window.from) },
                leadsBefore: { kind: "count", where: before("createdAt", window.from) },
                consulted: { kind: "count", where: all(advanced, from("createdAt", window.from)) },
                consultedBefore: { kind: "count", where: all(advanced, before("createdAt", window.from)) },
            },
            limit: GROUP_LIMIT,
        })
        const sum = (name: string): number => rows.reduce((total, row) => total + numberOf(row.measures[name]), 0)
        return {
            leads: { current: sum("leads"), previous: sum("leadsBefore") },
            consulted: { current: sum("consulted"), previous: sum("consultedBefore") },
            byChannel: new Map(rows.map((row) => [row.groups.channel ?? "other", numberOf(row.measures.leads)])),
        }
    }

    /** What the newest paid orders of the period came to, by the channel of their lead (an order with no lead counts to none). */
    private async channelRevenue(tx: ScopedTx, window: DashboardWindow): Promise<ReadonlyMap<string, number>> {
        const revenue = new Map<string, number>()
        const where = all(eq("status", "paid"), within("createdAt", window.from, window.to))
        const read = async (after: string | undefined, pages: number): Promise<void> => {
            const page = await this.engine.list(
                tx,
                {
                    from: ORDER,
                    select: ["amountVnd"],
                    join: { lead: ["channel"] },
                    where,
                    order: [
                        ["createdAt", "desc"],
                        ["id", "desc"],
                    ],
                    page: after === undefined ? { size: PAGE_SIZE } : { size: PAGE_SIZE, after },
                },
                "dashboard.channel-revenue",
            )
            for (const row of page.rows) {
                const channel = row.joined.lead?.data.channel
                if (typeof channel === "string")
                    revenue.set(channel, (revenue.get(channel) ?? 0) + numberOf(row.row.data.amountVnd))
            }
            if (page.next !== null && pages > 1) await read(page.next, pages - 1)
        }
        await read(undefined, CHANNEL_ORDER_PAGES)
        return revenue
    }

    /** One figure for each day, in as few statements as the per-statement bound allows. */
    private async perDay(
        tx: ScopedTx,
        entity: string,
        timeField: string,
        days: ReadonlyArray<DashboardDay>,
        figure: PerDayFigure,
    ): Promise<ReadonlyMap<string, number>> {
        const byDay = new Map<string, number>()
        await eachInOrder(chunksOf(days, DAYS_PER_STATEMENT), async (chunk) => {
            const first = chunk[0]
            const last = chunk[chunk.length - 1]
            if (first === undefined || last === undefined) return
            const aggregate: Aggregate = {
                from: entity,
                where: all(...figure.base, within(timeField, first.from, last.to)),
                measures: Object.fromEntries(
                    chunk.map((day, index) => [
                        `d${String(index)}`,
                        {
                            kind: figure.kind,
                            ...(figure.field === undefined ? {} : { field: figure.field }),
                            where: within(timeField, day.from, day.to),
                        },
                    ]),
                ),
                limit: 1,
            }
            const measures = firstOf(await this.engine.aggregate(tx, aggregate))
            chunk.forEach((day, index) => byDay.set(day.day, numberOf(measures[`d${String(index)}`])))
        })
        return byDay
    }

    /** Replies an agent posted to customers in the period. */
    private async messagesAnswered(tx: ScopedTx, window: DashboardWindow): Promise<number> {
        const measures = firstOf(
            await this.engine.aggregate(tx, {
                from: MESSAGE,
                where: all(eq("role", "agent"), eq("status", "posted"), within("sentAt", window.from, window.to)),
                measures: { count: { kind: "count" } },
                limit: 1,
            }),
        )
        return numberOf(measures.count)
    }

    /** Runs that failed or were handed to a person in the period, per agent. */
    private async failedRuns(tx: ScopedTx, window: DashboardWindow): Promise<ReadonlyMap<string, number>> {
        const rows = await this.engine.aggregate(tx, {
            from: RUN,
            where: all(inSet("status", FAILED_RUN_STATUSES), within("startedAt", window.from, window.to)),
            groupBy: ["agentId"],
            measures: { count: { kind: "count" } },
            limit: GROUP_LIMIT,
        })
        return new Map(
            rows.flatMap((row): Array<[string, number]> =>
                row.groups.agentId === null || row.groups.agentId === undefined
                    ? []
                    : [[row.groups.agentId, numberOf(row.measures.count)]],
            ),
        )
    }
}
