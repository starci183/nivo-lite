import type { PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import { DONE_VIEW } from "../fixtures/platform.fixtures"
import type { AgentDone } from "../platform.types"
import { agentDonePort } from "../ports"
import { DONE_SHOWN, agentDoneRead } from "./agent-done.read"

const CONTEXT: RunContext = {
    workspaceId: "w1",
    memberId: "m1",
    now: new Date("2026-11-04T11:30:00.000Z"),
    timeZone: "Asia/Ho_Chi_Minh",
}

const run = (total: number) => {
    const limits: Array<number> = []
    const done: AgentDone = {
        recent: (_agent, limit) => {
            limits.push(limit)
            return Promise.resolve({ total, rows: total === 0 ? [] : DONE_VIEW.rows })
        },
    }
    const provider: PortProvider = {
        implementationOf: (port) => (port.id === agentDonePort.id ? done : undefined),
    }
    return { limits, result: agentDoneRead.execute?.(provider, { agent: "sales" }, CONTEXT) }
}

describe("platform.agent-done", () => {
    it("counts what the agent finished and lists the newest, with how many more there are", async () => {
        const { limits, result } = run(42)
        await expect(result).resolves.toMatchObject({ ok: true, data: { count: "42", more: "+40" } })
        expect(limits).toEqual([DONE_SHOWN])
    })

    it("has no count and no more when nothing was finished, or when every item is listed", async () => {
        await expect(run(0).result).resolves.toMatchObject({ ok: true, data: { count: null, rows: [], more: null } })
        await expect(run(2).result).resolves.toMatchObject({ ok: true, data: { count: "2", more: null } })
    })

    it("is read with the platform view permission and names the agent", () => {
        expect(agentDoneRead.permission).toBe("platform.view")
    })
})
