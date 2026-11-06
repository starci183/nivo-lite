import type { ListQuery } from "@nivo-lite/agent-sdk/block"
import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { entriesSource, providerOf } from "../accounting.doubles"
import { ENTRY_ROWS } from "../fixtures/accounting.fixtures"
import { entriesSourcePort } from "../ports"
import { WEEKLY_ENTRIES_MAX, weeklyRead } from "./weekly.read"

const CONTEXT: RunContext = { workspaceId: "w1", memberId: "m1", now: new Date("2026-11-04T11:30:00.000Z") }

const run = async (raw: unknown): Promise<{ readonly queries: ReadonlyArray<ListQuery>; readonly result: unknown }> => {
    const queries: Array<ListQuery> = []
    const provider = providerOf([
        [
            entriesSourcePort,
            entriesSource({
                page: (_shape, query) => {
                    queries.push(query)
                    return Promise.resolve({ rows: ENTRY_ROWS, cursor: null })
                },
            }),
        ],
    ])
    return { queries, result: await weeklyRead.execute?.(provider, raw, CONTEXT) }
}

describe("the accounting.weekly read", () => {
    it("adds the entries the source gives for this month by week", async () => {
        const { queries, result } = await run({})
        expect(queries).toEqual([
            { q: null, filters: { kind: "income" }, sort: "recent", cursor: null, size: WEEKLY_ENTRIES_MAX },
        ])
        expect(result).toEqual({ ok: true, data: { w1: 8_800_000, w2: 0, w3: 0, w4: 0, w5: 0 } })
    })

    it("leaves out entries that fall outside the period asked", async () => {
        const { result } = await run({ period: "last" })
        expect(result).toEqual({ ok: true, data: { w1: 0, w2: 0, w3: 0, w4: 0, w5: 0 } })
    })

    it("is read with the view permission", () => {
        expect(weeklyRead.permission).toBe("accounting.view")
    })
})
