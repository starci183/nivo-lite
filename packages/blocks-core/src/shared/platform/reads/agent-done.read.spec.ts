import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { AGENT_ID, coreRun, recordedCore, runsProvider } from "../fixtures/agent-runs.ports"
import { DONE_SHOWN, agentDoneRead } from "./agent-done.read"

const CONTEXT: RunContext = {
    workspaceId: "w1",
    memberId: "m1",
    now: new Date("2026-11-04T11:30:00.000Z"),
    timeZone: "Asia/Ho_Chi_Minh",
    locale: "vi",
}

const AGENT = AGENT_ID

/** Core reads with `listed` runs on the page and `counted` as the count of the done runs (null: the count answers no group). */
const run = (listed: number, counted: number | null, raw: unknown = { agent: AGENT }) => {
    const runs = Array.from({ length: listed }, (_, index) =>
        coreRun(`r${String(index)}`, { trigger: "tag", status: "done", endedAt: "2026-11-04T11:00:00.000Z" }),
    )
    const recorded = recordedCore(runs, { counts: counted === null ? [] : [{ status: "done", count: counted }] })
    return { ...recorded, result: agentDoneRead.execute?.(runsProvider(recorded.core), raw, CONTEXT) }
}

describe("platform.agent-done", () => {
    it("counts what the agent finished, lists the newest runs, with how many more there are", async () => {
        const { lists, counted, result } = run(DONE_SHOWN, 42)
        const answered = await result
        expect(answered).toMatchObject({ ok: true, data: { count: "42", more: "+37" } })
        const data = answered?.ok === true ? answered.data : null
        expect(data).toHaveProperty("rows.0.id", "r0")
        expect(data).toHaveProperty("rows.0.title", "tag")
        expect(lists[0]).toEqual({ agent: AGENT, statuses: ["done"], order: "ended", size: DONE_SHOWN })
        expect(counted[0]).toEqual({ agent: AGENT, statuses: ["done"] })
    })

    it("has no count and no more when nothing was finished, or when every item is listed", async () => {
        await expect(run(0, 0).result).resolves.toMatchObject({ ok: true, data: { count: null, rows: [], more: null } })
        await expect(run(2, 2).result).resolves.toMatchObject({ ok: true, data: { count: "2", more: null } })
    })

    it("counts the listed rows when the count answers no group", async () => {
        await expect(run(2, null).result).resolves.toMatchObject({ ok: true, data: { count: "2", more: null } })
    })

    it("refuses an agent that is no id", async () => {
        await expect(run(0, 0, { agent: "sales" }).result).resolves.toMatchObject({ ok: false })
    })

    it("is read with the platform view permission", () => {
        expect(agentDoneRead.permission).toBe("platform.view")
    })
})
