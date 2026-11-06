import {
    AGENT_ID,
    GRAPH_ROW,
    INSTALLATION_ID,
    RUNS_CONTEXT,
    fakeEntity,
    recordRow,
    runsProvider,
} from "../fixtures/agent-runs.ports"
import { RUNS_PAGE, RUNS_PAGE_MAX, agentRunsRead } from "./agent-runs.read"

const RUN = recordRow("run-1", {
    agentId: AGENT_ID,
    trigger: "zalo.message",
    status: "parked",
    startedAt: "2026-11-05T08:00:00.000Z",
    endedAt: null,
})

const run = (raw: unknown, graphs = [GRAPH_ROW], next: string | null = null) => {
    const graph = fakeEntity(graphs)
    const runs = fakeEntity([RUN], { next })
    return {
        graph,
        runs,
        result: agentRunsRead.execute?.(
            runsProvider({ graphs: graph.api, runs: runs.api, steps: runs.api }),
            raw,
            RUNS_CONTEXT,
        ),
    }
}

describe("platform.agent-runs", () => {
    it("lists the runs of the agent the installation runs, newest first, one page at a time, with the cursor of the next", async () => {
        const { runs, result } = run({ installation: INSTALLATION_ID }, [GRAPH_ROW], "cursor-2")
        await expect(result).resolves.toEqual({
            ok: true,
            data: {
                rows: [
                    {
                        id: "run-1",
                        status: "parked",
                        trigger: "zalo.message",
                        when: "11/5/26, 8:00 AM",
                        duration: "10:00",
                    },
                ],
                cursor: "cursor-2",
            },
        })
        expect(runs.queries[0]).toMatchObject({
            where: { op: "eq", field: "agentId", value: AGENT_ID },
            order: [
                ["startedAt", "desc"],
                ["id", "desc"],
            ],
            page: { size: RUNS_PAGE },
        })
    })

    it("narrows the page to the statuses of a filter, and not at all for all", async () => {
        const narrowed = run({ installation: INSTALLATION_ID, status: "failed" })
        await narrowed.result
        expect(narrowed.runs.queries[0]?.where).toEqual({
            op: "and",
            of: [
                { op: "eq", field: "agentId", value: AGENT_ID },
                { op: "in", field: "status", values: ["failed", "dead"] },
            ],
        })
        const everything = run({ installation: INSTALLATION_ID, status: "all" })
        await everything.result
        expect(everything.runs.queries[0]?.where).toEqual({ op: "eq", field: "agentId", value: AGENT_ID })
    })

    it("asks for the page after the cursor, with the limit given", async () => {
        const next = run({ installation: INSTALLATION_ID, cursor: "cursor-2", limit: 5 })
        await next.result
        expect(next.runs.queries[0]?.page).toEqual({ size: 5, after: "cursor-2" })
    })

    it("lists nothing for an installation the workspace does not have", async () => {
        const { runs, result } = run({ installation: INSTALLATION_ID }, [])
        await expect(result).resolves.toEqual({ ok: true, data: { rows: [], cursor: null } })
        expect(runs.queries).toEqual([])
    })

    it("refuses an installation that is no id, a limit beyond the bound and a variable it does not declare", async () => {
        await expect(run({ installation: "x" }).result).resolves.toMatchObject({ ok: false })
        await expect(run({ installation: INSTALLATION_ID, limit: RUNS_PAGE_MAX + 1 }).result).resolves.toMatchObject({
            ok: false,
        })
        await expect(run({ installation: INSTALLATION_ID, owner: "x" }).result).resolves.toMatchObject({ ok: false })
        await expect(run({ installation: INSTALLATION_ID, status: "gone" }).result).resolves.toMatchObject({
            ok: false,
        })
    })

    it("is read with the platform view permission and lists rows", () => {
        expect(agentRunsRead.permission).toBe("platform.view")
        expect(agentRunsRead.shape).toBe("list")
    })

    it("tells a host it is a list paged by a cursor, newest first, one page of the default size", () => {
        expect(agentRunsRead.listing).toMatchObject({ kind: "list", defaultSort: "recent" })
        expect(agentRunsRead.listing?.kind === "list" ? agentRunsRead.listing.shape.page.size : 0).toBe(RUNS_PAGE)
    })
})
