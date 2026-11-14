import { AGENT_ID, INSTALLATION_ID, RUNS_CONTEXT, coreRun, coreStep, recordedCore, runsProvider } from "../fixtures/agent-runs.ports"
import { RUN_STEPS_MAX } from "../../../rows/graph-view"
import { agentRunRead } from "./agent-run.read"

const RUN = coreRun("run-3", { agentId: AGENT_ID, status: "parked", parkReason: "The send was refused" })
const OTHER = coreRun("run-9", { agentId: "11111111-1111-4111-8111-111111111111", status: "done" })
const STEP = coreStep("s1", { stepKey: "send", nodeKey: "send-quote", status: "failed", errorCode: "REFUSED" })

const run = (id: string, agents?: Readonly<Record<string, string>>) => {
    const recorded = recordedCore([RUN, OTHER], { steps: [STEP], ...(agents === undefined ? {} : { agents }) })
    return {
        ...recorded,
        result: agentRunRead.execute?.(runsProvider(recorded.core), { installation: INSTALLATION_ID, id }, RUNS_CONTEXT),
    }
}

describe("platform.agent-run", () => {
    it("answers the run with its steps in order, the one that parked it told as parked", async () => {
        const { stepsAsked, result } = run("run-3")
        await expect(result).resolves.toMatchObject({
            ok: true,
            data: {
                id: "run-3",
                status: "parked",
                steps: [{ id: "send", node: "send-quote", state: "parked", reason: "The send was refused" }],
            },
        })
        expect(stepsAsked).toEqual([{ runId: "run-3", limit: RUN_STEPS_MAX }])
    })

    it("answers nothing for a run of another agent or one that is gone, and reads no step", async () => {
        const other = run("run-9")
        await expect(other.result).resolves.toEqual({ ok: true, data: null })
        await expect(run("run-0").result).resolves.toEqual({ ok: true, data: null })
        expect(other.stepsAsked).toEqual([])
    })

    it("answers nothing for an installation the workspace does not have, and does not look the run up", async () => {
        const { gets, result } = run("run-3", {})
        await expect(result).resolves.toEqual({ ok: true, data: null })
        expect(gets).toEqual([])
    })

    it("is read with the platform view permission as a record with its steps listed", () => {
        expect(agentRunRead.permission).toBe("platform.view")
        expect(agentRunRead.paths).toEqual({ steps: "list" })
    })
})
