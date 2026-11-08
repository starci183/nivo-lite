import type { AggregateRow, EntityApi, EntityAggregate, EntityQuery, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import { BlocksError } from "../../../blocks-error"
import { agentRuns } from "../ports"
import { DONE_SHOWN, agentDoneRead } from "./agent-done.read"

const CONTEXT: RunContext = {
    workspaceId: "w1",
    memberId: "m1",
    now: new Date("2026-11-04T11:30:00.000Z"),
    timeZone: "Asia/Ho_Chi_Minh",
    locale: "vi",
}

const AGENT = "6f1c3a52-0f0b-4b57-9a2c-1c2f6d7e8a90"

const runRow = (id: string): RecordRow => ({
    id,
    workspaceId: "w1",
    version: "1",
    createdAt: "2026-11-04T10:00:00.000Z",
    updatedAt: "2026-11-04T10:00:00.000Z",
    data: { trigger: "tag", endedAt: "2026-11-04T11:00:00.000Z" },
})

const unused = (): Promise<never> => Promise.reject(new BlocksError("FAKE_PORT_UNUSED", "agent-runs"))

/** A runs port with `listed` rows on its page and `counted` as the aggregate's count (null: the aggregate answers no group). */
const run = (listed: number, counted: number | null, raw: unknown = { agent: AGENT }) => {
    const queries: Array<EntityQuery> = []
    const aggregates: Array<EntityAggregate> = []
    const runs: EntityApi = {
        get: unused,
        insert: unused,
        update: unused,
        upsert: unused,
        ensure: unused,
        delete: unused,
        link: unused,
        unlink: unused,
        list: (query) => {
            queries.push(query)
            return Promise.resolve({
                rows: Array.from({ length: listed }, (_, index) => ({
                    row: runRow(`r${String(index)}`),
                    joined: {},
                    position: [],
                    included: {},
                })),
                next: null,
            })
        },
        aggregate: (aggregate): Promise<ReadonlyArray<AggregateRow>> => {
            aggregates.push(aggregate)
            return Promise.resolve(counted === null ? [] : [{ groups: {}, measures: { count: counted } }])
        },
    }
    const provider: PortProvider = { implementationOf: (port) => (port.id === agentRuns.id ? runs : undefined) }
    return { queries, aggregates, result: agentDoneRead.execute?.(provider, raw, CONTEXT) }
}

describe("platform.agent-done", () => {
    it("counts what the agent finished, lists the newest runs, with how many more there are", async () => {
        const { queries, aggregates, result } = run(DONE_SHOWN, 42)
        const answered = await result
        expect(answered).toMatchObject({ ok: true, data: { count: "42", more: "+37" } })
        const data = answered?.ok === true ? answered.data : null
        expect(data).toHaveProperty("rows.0.id", "r0")
        expect(data).toHaveProperty("rows.0.title", "tag")
        expect(queries[0]).toMatchObject({
            order: [
                ["endedAt", "desc"],
                ["id", "desc"],
            ],
            page: { size: DONE_SHOWN },
        })
        expect(aggregates[0]).toMatchObject({ measures: { count: { kind: "count" } } })
        expect(JSON.stringify(queries[0]?.where)).toContain(AGENT)
    })

    it("has no count and no more when nothing was finished, or when every item is listed", async () => {
        await expect(run(0, 0).result).resolves.toMatchObject({ ok: true, data: { count: null, rows: [], more: null } })
        await expect(run(2, 2).result).resolves.toMatchObject({ ok: true, data: { count: "2", more: null } })
    })

    it("counts the listed rows when the aggregate answers no group", async () => {
        await expect(run(2, null).result).resolves.toMatchObject({ ok: true, data: { count: "2", more: null } })
    })

    it("refuses an agent that is no id", async () => {
        await expect(run(0, 0, { agent: "sales" }).result).resolves.toMatchObject({ ok: false })
    })

    it("is read with the platform view permission", () => {
        expect(agentDoneRead.permission).toBe("platform.view")
    })
})
