import { AGENT_ID, INSTALLATION_ID, RUNS_CONTEXT, recordedCore, runsProvider } from "../fixtures/agent-runs.ports"
import { agentRunCountsRead } from "./agent-run-counts.read"

const run = (agents?: Readonly<Record<string, string>>) => {
    const recorded = recordedCore([], {
        counts: [
            { status: "done", count: 7 },
            { status: "parked", count: 2 },
        ],
        ...(agents === undefined ? {} : { agents }),
    })
    return {
        ...recorded,
        result: agentRunCountsRead.execute?.(runsProvider(recorded.core), { installation: INSTALLATION_ID }, RUNS_CONTEXT),
    }
}

// G-SLIM (13:26) added the `cancelled` filter to the run counts by design; P-NEXT made the spec follow it.
describe("platform.agent-run-counts", () => {
    it("counts the runs of the agent per filter by their status, and in all", async () => {
        const { counted, result } = run()
        await expect(result).resolves.toEqual({
            ok: true,
            data: { counts: { running: 0, parked: 2, done: 7, failed: 0, cancelled: 0 }, total: 9 },
        })
        expect(counted).toEqual([{ agent: AGENT_ID, statuses: undefined }])
    })

    it("counts nothing for an installation the workspace does not have", async () => {
        const { counted, result } = run({})
        await expect(result).resolves.toEqual({
            ok: true,
            data: { counts: { running: 0, parked: 0, done: 0, failed: 0, cancelled: 0 }, total: 0 },
        })
        expect(counted).toEqual([])
    })

    it("is read with the platform view permission as a record of counts", () => {
        expect(agentRunCountsRead.permission).toBe("platform.view")
        expect(agentRunCountsRead.fields).toEqual(["counts", "total"])
    })
})
