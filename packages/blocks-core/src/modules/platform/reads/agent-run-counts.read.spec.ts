import { GRAPH_ROW, INSTALLATION_ID, RUNS_CONTEXT, fakeEntity, runsProvider } from "../fixtures/agent-runs.ports"
import { agentRunCountsRead } from "./agent-run-counts.read"

const run = (graphs = [GRAPH_ROW]) => {
    const graph = fakeEntity(graphs)
    const runs = fakeEntity([], {
        groups: [
            { groups: { status: "done" }, measures: { count: 7 } },
            { groups: { status: "parked" }, measures: { count: 2 } },
        ],
    })
    return {
        runs,
        result: agentRunCountsRead.execute?.(
            runsProvider({ graphs: graph.api, runs: runs.api, steps: runs.api }),
            { installation: INSTALLATION_ID },
            RUNS_CONTEXT,
        ),
    }
}

describe("platform.agent-run-counts", () => {
    it("counts the runs of the agent per filter by their status, and in all", async () => {
        const { runs, result } = run()
        await expect(result).resolves.toEqual({
            ok: true,
            data: { counts: { running: 0, parked: 2, done: 7, failed: 0 }, total: 9 },
        })
        expect(runs.aggregates[0]).toMatchObject({ groupBy: ["status"], measures: { count: { kind: "count" } } })
    })

    it("counts nothing for an installation the workspace does not have", async () => {
        const { runs, result } = run([])
        await expect(result).resolves.toEqual({
            ok: true,
            data: { counts: { running: 0, parked: 0, done: 0, failed: 0 }, total: 0 },
        })
        expect(runs.aggregates).toEqual([])
    })

    it("is read with the platform view permission as a record of counts", () => {
        expect(agentRunCountsRead.permission).toBe("platform.view")
        expect(agentRunCountsRead.fields).toEqual(["counts", "total"])
    })
})
