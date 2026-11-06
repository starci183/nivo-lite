import { AgentRunResumeService } from "../../../modules/domain/agent-runs/agent-run-resume.service"
import { AgentRunStoreService } from "../../../modules/domain/agent-runs/agent-run-store.service"
import { AgentRunsService } from "../../../modules/domain/agent-runs/agent-runs.service"
import { useTestWorld } from "../../world/use-test-world"
import { AGENT_RUNS_MODULES } from "../../world/agent-runs-capabilities.options"
import { ScriptedWorld, chainFrom } from "../../world/agent-runs-script.service"
import { sceneOf } from "@tests/world/agent-runs-scene.service"

const world = useTestWorld({ modules: AGENT_RUNS_MODULES })
const scene = sceneOf(world)

const script = () => world.resolve(ScriptedWorld)
const runs = () => world.resolve(AgentRunsService)
const store = () => world.resolve(AgentRunStoreService)
const resumer = () => world.resolve(AgentRunResumeService)
const SIGNAL = new AbortController().signal
const em = () => world.db.primary

beforeEach(() => script().reset())

const statuses = async (runId: string): Promise<ReadonlyArray<string>> =>
    (await scene.stepsOf(runId)).map((step) => `${step.stepKey}:${step.status}`)

describe("agent-runs/park-resume: a run that stopped for a fix runs again from its failed step", () => {
    it("agent-runs/park-resume: the done steps and the pivot are not repeated, and who resumed and why stay on the run", async () => {
        const { runId, wakeId } = await scene.newRun("park-then-resume")
        script().toolTries = [{ kind: "failed", code: "invalid_step_input" }]
        await em().transaction((tx) =>
            runs().append(scene.workspaceId, tx, runId, [
                chainFrom("door", wakeId),
                chainFrom("reply", wakeId),
                chainFrom("tool", wakeId),
            ]),
        )

        await runs().advance(scene.workspaceId, runId, SIGNAL)

        expect(await statuses(runId)).toEqual(["turn:done", "door:done", "reply:done", "tool:failed"])
        expect(await scene.runRow(runId)).toMatchObject({ status: "parked" })
        expect(script().performed).toEqual([`door:${wakeId}`, `reply:${wakeId}`])

        await expect(
            resumer().resume({ workspaceId: scene.workspaceId, runId, actor: "member-1", reason: "scope fixed" }),
        ).resolves.toMatchObject({
            kind: "resumed",
            stepKey: "tool",
        })
        await runs().advance(scene.workspaceId, runId, SIGNAL)

        expect(await statuses(runId)).toEqual(["turn:done", "door:done", "reply:done", "tool:done"])
        expect(script().performed).toEqual([`door:${wakeId}`, `reply:${wakeId}`, `tool:${wakeId}`])
        expect(await scene.runRow(runId)).toMatchObject({
            status: "done",
            resumedBy: "member-1",
            resumeReason: "scope fixed",
        })
    })

    it("agent-runs/park-resume: a run that is not parked is refused", async () => {
        const { runId, wakeId } = await scene.newRun("not-parked")
        await em().transaction((tx) => runs().append(scene.workspaceId, tx, runId, [chainFrom("door", wakeId)]))

        await expect(
            resumer().resume({ workspaceId: scene.workspaceId, runId, actor: "member-1", reason: "x" }),
        ).resolves.toEqual({
            kind: "not_parked",
        })
    })
})

describe("agent-runs/park-resume: a dead-lettered run runs again from its failed step", () => {
    it("agent-runs/park-resume: a dead-lettered run runs again from its failed step once, and a second resume does not run it twice", async () => {
        const { runId, wakeId } = await scene.newRun("dead-then-resume")
        script().toolTries = [{ kind: "failed", code: "invalid_step_input" }]
        await em().transaction((tx) =>
            runs().append(scene.workspaceId, tx, runId, [chainFrom("door", wakeId), chainFrom("tool", wakeId)]),
        )
        await runs().advance(scene.workspaceId, runId, SIGNAL)
        await store().route(scene.workspaceId, runId, {
            from: "parked",
            to: "dead",
            code: "dead_lettered",
            compensate: [],
        })
        expect(await scene.runRow(runId)).toMatchObject({ status: "dead" })

        const request = { workspaceId: scene.workspaceId, runId, actor: "member-1", reason: "fix deployed" }
        await expect(resumer().resume(request)).resolves.toMatchObject({ kind: "resumed", stepKey: "tool" })
        await expect(resumer().resume(request)).resolves.toEqual({ kind: "not_parked" })
        await runs().advance(scene.workspaceId, runId, SIGNAL)

        // the tool step chains the reply, so the resumed run goes on to the end of its graph
        expect(await statuses(runId)).toEqual(["turn:done", "door:done", "tool:done", "reply:done"])
        expect(script().performed).toEqual([`door:${wakeId}`, `tool:${wakeId}`, `reply:${wakeId}`])
        expect(await scene.runRow(runId)).toMatchObject({ status: "done", resumedBy: "member-1" })
    })

    it("agent-runs/park-resume: a dead run whose done steps are being undone is refused", async () => {
        const { runId, wakeId } = await scene.newRun("dead-undone")
        script().toolTries = [{ kind: "failed", code: "invalid_step_input" }]
        await em().transaction((tx) =>
            runs().append(scene.workspaceId, tx, runId, [chainFrom("door", wakeId), chainFrom("tool", wakeId)]),
        )
        await runs().advance(scene.workspaceId, runId, SIGNAL)
        await store().route(scene.workspaceId, runId, { from: "parked", to: "dead", code: "x", compensate: ["door"] })

        await expect(
            resumer().resume({ workspaceId: scene.workspaceId, runId, actor: "member-1", reason: "x" }),
        ).resolves.toEqual({ kind: "compensated" })
    })
})
