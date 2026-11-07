import {
    AGENT_ID,
    GRAPH_ROW,
    INSTALLATION_ID,
    RUNS_CONTEXT,
    recordedEntity,
    recordRow,
    runsProvider,
} from "../fixtures/agent-runs.ports"
import { QUERY_BOUNDS } from "@nivo-lite/agent-sdk/query"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { RUN_STEPS_MAX } from "../../../rows/graph-view"
import { STEPS_PAGE, agentRunRead } from "./agent-run.read"

const RUN = recordRow("run-3", { agentId: AGENT_ID, status: "parked", parkReason: "The send was refused" })
const OTHER = recordRow("run-9", { agentId: "11111111-1111-4111-8111-111111111111", status: "done" })
const STEP = recordRow("s1", { stepKey: "send", nodeKey: "send-quote", status: "failed", errorCode: "REFUSED" })

const run = (id: string, graphs = [GRAPH_ROW]) => {
    const graph = recordedEntity(graphs)
    const runs = recordedEntity([RUN, OTHER])
    const steps = recordedEntity([STEP])
    return {
        runs,
        steps,
        result: agentRunRead.execute?.(
            runsProvider({ graphs: graph.api, runs: runs.api, steps: steps.api }),
            { installation: INSTALLATION_ID, id },
            RUNS_CONTEXT,
        ),
    }
}

describe("platform.agent-run", () => {
    it("answers the run with its steps in order, the one that parked it told as parked", async () => {
        const { steps, result } = run("run-3")
        await expect(result).resolves.toMatchObject({
            ok: true,
            data: {
                id: "run-3",
                status: "parked",
                steps: [{ id: "send", node: "send-quote", state: "parked", reason: "The send was refused" }],
            },
        })
        expect(steps.queries[0]).toMatchObject({
            where: { op: "eq", field: "runId", value: "run-3" },
            order: [
                ["ordinal", "asc"],
                ["id", "asc"],
            ],
        })
    })

    it("answers nothing for a run of another agent or one that is gone, and reads no step", async () => {
        const other = run("run-9")
        await expect(other.result).resolves.toEqual({ ok: true, data: null })
        await expect(run("run-0").result).resolves.toEqual({ ok: true, data: null })
        expect(other.steps.queries).toEqual([])
    })

    it("answers nothing for an installation the workspace does not have, and does not look the run up", async () => {
        const { runs, result } = run("run-3", [])
        await expect(result).resolves.toEqual({ ok: true, data: null })
        expect(runs.gets).toEqual([])
    })

    it("is read with the platform view permission as a record with its steps listed", () => {
        expect(agentRunRead.permission).toBe("platform.view")
        expect(agentRunRead.paths).toEqual({ steps: "list" })
    })

    it("reads the steps of a long run in pages the engine accepts, up to the cap the timeline draws", async () => {
        const sizes: Array<number> = []
        const rows = Array.from({ length: RUN_STEPS_MAX + 50 }, (_, index) =>
            recordRow(`s${String(index)}`, { stepKey: `k${String(index)}`, status: "done" }),
        )
        const pages = recordedEntity([])
        const steps = {
            ...pages.api,
            list: (query: Parameters<typeof pages.api.list>[0]) => {
                sizes.push(query.page.size)
                const from = query.page.after === undefined ? 0 : Number(query.page.after)
                const slice: ReadonlyArray<RecordRow> = rows.slice(from, from + query.page.size)
                return Promise.resolve({
                    rows: slice.map((row) => ({ row, joined: {}, position: [], included: {} })),
                    next: String(from + query.page.size),
                })
            },
        }
        const result = await agentRunRead.execute?.(
            runsProvider({ graphs: recordedEntity([GRAPH_ROW]).api, runs: recordedEntity([RUN]).api, steps }),
            { installation: INSTALLATION_ID, id: "run-3" },
            RUNS_CONTEXT,
        )
        expect(result).toMatchObject({ ok: true })
        expect(sizes).toEqual([STEPS_PAGE, STEPS_PAGE, RUN_STEPS_MAX - 2 * STEPS_PAGE].filter((size) => size > 0))
        expect(sizes.every((size) => size <= QUERY_BOUNDS.pageSize)).toBe(true)
        expect(STEPS_PAGE).toBeLessThanOrEqual(QUERY_BOUNDS.pageSize)
    })
})
