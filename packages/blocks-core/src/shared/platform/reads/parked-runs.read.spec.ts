import type { PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import { PARKED_RUNS_VIEW } from "../fixtures/platform.fixtures"
import type { ParkedRunFilter, ParkedRuns } from "../platform.types"
import { parkedRunsPort } from "../ports"
import { PARKED_DEFAULT, PARKED_MAX, parkedRunsRead } from "./parked-runs.read"

const CONTEXT: RunContext = {
    workspaceId: "w1",
    memberId: "m1",
    now: new Date("2026-11-04T11:30:00.000Z"),
    timeZone: "Asia/Ho_Chi_Minh",
    locale: "vi",
}

const run = (total: number, raw: unknown) => {
    const asked: Array<{ filter: ParkedRunFilter; limit: number }> = []
    const parked: ParkedRuns = {
        list: (filter, limit) => {
            asked.push({ filter, limit })
            return Promise.resolve({ total, rows: total === 0 ? [] : PARKED_RUNS_VIEW.rows })
        },
        find: () => Promise.resolve(null),
        resume: () => Promise.resolve(false),
    }
    const provider: PortProvider = { implementationOf: (port) => (port.id === parkedRunsPort.id ? parked : undefined) }
    return { asked, result: parkedRunsRead.execute?.(provider, raw, CONTEXT) }
}

describe("platform.parked-runs", () => {
    it("lists the parked runs with how many there are, under the default limit", async () => {
        const { asked, result } = run(2, {})
        await expect(result).resolves.toEqual({ ok: true, data: { count: "2", rows: PARKED_RUNS_VIEW.rows } })
        expect(asked).toEqual([{ filter: {}, limit: PARKED_DEFAULT }])
    })

    it("hands the module, the subject and the limit to the port", async () => {
        const { asked } = run(0, { module: "sales", subjectKind: "blocks-core.sales.order", subjectId: "order-1", limit: 5 })
        await Promise.resolve()
        expect(asked).toEqual([
            { filter: { module: "sales", subjectKind: "blocks-core.sales.order", subjectId: "order-1" }, limit: 5 },
        ])
    })

    it("has no count when nothing is parked", async () => {
        await expect(run(0, {}).result).resolves.toEqual({ ok: true, data: { count: null, rows: [] } })
    })

    it("refuses a limit beyond the bound and a variable it does not declare", async () => {
        await expect(run(0, { limit: PARKED_MAX + 1 }).result).resolves.toMatchObject({ ok: false })
        await expect(run(0, { owner: "x" }).result).resolves.toMatchObject({ ok: false })
    })

    it("is read with the platform view permission", () => {
        expect(parkedRunsRead.permission).toBe("platform.view")
    })
})
