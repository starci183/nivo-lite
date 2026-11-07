import type { EntityApi, EntityQuery } from "@nivo-lite/agent-sdk/entity/port"
import { queryProblems } from "@nivo-lite/agent-sdk/query"
import type { EntityCatalog } from "@nivo-lite/agent-sdk/query"
import { FLOW_F_ENTITIES } from "../../entities/flow-f.entities"
import { cancelFactsOf, openClaimsOf } from "./order-links"

const CATALOG: EntityCatalog = new Map(FLOW_F_ENTITIES.map((entity) => [entity.name, entity]))

/** An entity port that answers a count, with the aggregates it was asked. */
interface RecordingPort {
    readonly api: EntityApi
    readonly asked: Array<Parameters<EntityApi["aggregate"]>[0]>
}

/** An entity port that answers a count and records the aggregate it was asked. */
const recording = (count: number | undefined): RecordingPort => {
    const asked: Array<Parameters<EntityApi["aggregate"]>[0]> = []
    const api: EntityApi = {
        get: () => Promise.resolve(null),
        list: () => Promise.resolve({ rows: [], next: null }),
        aggregate: (aggregate) => {
            asked.push(aggregate)
            return Promise.resolve(count === undefined ? [] : [{ groups: {}, measures: { n: count } }])
        },
        update: () => Promise.resolve({ ok: false, reason: "invalid" }),
        insert: () => Promise.resolve({ ok: false, reason: "invalid" }),
        upsert: () => Promise.resolve({ ok: false, reason: "invalid" }),
        ensure: () => Promise.reject(new Error("unused")),
        delete: () => Promise.reject(new Error("unused")),
        link: () => Promise.reject(new Error("unused")),
        unlink: () => Promise.reject(new Error("unused")),
    }
    return { api, asked }
}

describe("the facts a cancellation reads", () => {
    it("counts the payments and the invoices on an order, and reads a missing count as none", async () => {
        const payments = recording(2)
        const invoices = recording(undefined)
        expect(
            await cancelFactsOf(
                { transactions: payments.api, invoices: invoices.api },
                { id: "o-1", status: "confirmed" },
            ),
        ).toEqual({ status: "confirmed", allocations: 2, invoices: 0 })
    })

    it("asks queries the planner accepts against the entities the engine declares", async () => {
        const payments = recording(0)
        const invoices = recording(0)
        await cancelFactsOf({ transactions: payments.api, invoices: invoices.api }, { id: "o-1", status: "confirmed" })
        const verdicts = [
            ...payments.asked.map((asked) => queryProblems({ from: "payment.transaction", ...asked }, CATALOG)),
            ...invoices.asked.map((asked) => queryProblems({ from: "accounting.invoice", ...asked }, CATALOG)),
        ]
        expect(verdicts).toEqual([[], []])
    })

    it("lists the open and escalated claims through an index the planner finds", async () => {
        const asked: Array<EntityQuery> = []
        const claims: EntityApi = {
            ...recording(0).api,
            list: (query) => {
                asked.push(query)
                return Promise.resolve({ rows: [], next: null })
            },
        }
        expect(await openClaimsOf(claims, "o-1")).toEqual([])
        expect(asked).toHaveLength(2)
        asked.forEach((query) => expect(queryProblems({ from: "payment.claim", ...query }, CATALOG)).toEqual([]))
    })
})
