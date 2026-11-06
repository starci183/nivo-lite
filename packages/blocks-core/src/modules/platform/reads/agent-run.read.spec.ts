import {
    AGENT_ID,
    GRAPH_ROW,
    INSTALLATION_ID,
    RUNS_CONTEXT,
    fakeEntity,
    recordRow,
    runsProvider,
} from "../fixtures/agent-runs.ports"
import { agentRunRead } from "./agent-run.read"

const RUN = recordRow("run-3", { agentId: AGENT_ID, status: "parked", parkReason: "The send was refused" })
const OTHER = recordRow("run-9", { agentId: "11111111-1111-4111-8111-111111111111", status: "done" })
const STEP = recordRow("s1", { stepKey: "send", nodeKey: "send-quote", status: "failed", errorCode: "REFUSED" })

const run = (id: string, graphs = [GRAPH_ROW]) => {
    const graph = fakeEntity(graphs)
    const runs = fakeEntity([RUN, OTHER])
    const steps = fakeEntity([STEP])
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
})
