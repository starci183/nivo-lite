import { AgentRunSweepService } from "../../../modules/domain/agent-runs/agent-run-sweep.service"
import { AgentRunsService } from "../../../modules/domain/agent-runs/agent-runs.service"
import { AgentStepJobService } from "../../../modules/domain/agent-runs/agent-step-job.service"
import { useTestWorld } from "../../world/use-test-world"
import { AGENT_RUNS_MODULES } from "../../world/agent-runs-capabilities.options"
import { ScriptedWorld } from "../../world/agent-runs-script.service"
import { sceneOf } from "./agent-runs.scene"

const world = useTestWorld({ modules: AGENT_RUNS_MODULES })
const scene = sceneOf(world)

const script = () => world.resolve(ScriptedWorld)
const runs = () => world.resolve(AgentRunsService)
const SIGNAL = new AbortController().signal

beforeEach(() => script().reset())

const statuses = async (runId: string): Promise<ReadonlyArray<string>> =>
    (await scene.stepsOf(runId)).map((step) => `${step.stepKey}:${step.status}`)

const ALL_DONE = ["turn:done", "door:done", "tool:done", "reply:done"]

describe("agent-runs/kill-mid-turn: the API dies while the model turn runs", () => {
    it("agent-runs/kill-mid-turn: the sweep takes the turn over and the chain finishes once, and the dead worker's late write changes nothing", async () => {
        const { runId, wakeId } = await scene.newRun("kill-mid-turn")
        const hang = script().hangOnce("turn", "before")
        const dying = runs().advance(runId, SIGNAL)
        await hang.entered

        await scene.expireClaims(runId)
        await world.resolve(AgentRunSweepService).sweep()

        expect(await statuses(runId)).toEqual(ALL_DONE)
        expect(script().performed).toEqual([`door:${wakeId}`, `tool:${wakeId}`, `reply:${wakeId}`])
        expect((await scene.stepsOf(runId))[0]?.attempt).toBe(2)

        hang.release()
        await dying

        expect(await statuses(runId)).toEqual(ALL_DONE)
        expect(script().performed).toHaveLength(3)
        expect((await scene.runRow(runId)).status).toBe("done")
    })
})

describe("agent-runs/kill-after-tool: the API dies after the tool acted and before its result is stored", () => {
    it("agent-runs/kill-after-tool: the retaken step finds the receipt, so the tool acted once and the reply is sent once", async () => {
        const { runId, wakeId } = await scene.newRun("kill-after-tool")
        const hang = script().hangOnce("tool", "after")
        const dying = runs().advance(runId, SIGNAL)
        await hang.entered
        expect(script().performed).toContain(`tool:${wakeId}`)

        await scene.expireClaims(runId)
        await world.resolve(AgentRunSweepService).sweep()

        expect(await statuses(runId)).toEqual(ALL_DONE)
        expect(script().performed.filter((effect) => effect.startsWith("tool:"))).toEqual([`tool:${wakeId}`])
        expect(script().performed.filter((effect) => effect.startsWith("reply:"))).toEqual([`reply:${wakeId}`])

        hang.release()
        await dying

        expect(script().performed.filter((effect) => effect.startsWith("tool:"))).toHaveLength(1)
        expect(script().performed.filter((effect) => effect.startsWith("reply:"))).toHaveLength(1)
        expect(await statuses(runId)).toEqual(ALL_DONE)
    })

    it("agent-runs/kill-after-tool: a tool that began and left no receipt goes to a person once and is never called again", async () => {
        const { runId, wakeId } = await scene.newRun("tool-unknown")
        script().started.add(`tool:${wakeId}`)

        await runs().advance(runId, SIGNAL)
        await runs().advance(runId, SIGNAL)
        await world.resolve(AgentRunSweepService).sweep()

        expect(script().calls.get("tool")).toBe(1)
        expect(script().performed).toEqual([`door:${wakeId}`])
        expect((await scene.runRow(runId)).status).toBe("dead")
        expect((await scene.runRow(runId)).errorCode).toBe("tool_outcome_unknown")
        expect(script().told).toEqual(["tool:tool_outcome_unknown"])
    })
})

describe("agent-runs/kill-before-reply: the API dies between the tool's result and the reply", () => {
    it("agent-runs/kill-before-reply: the result, the reply step and its job commit together, and the job sends the reply once even when delivered twice", async () => {
        const { runId, wakeId } = await scene.newRun("kill-before-reply")
        const dying = new AbortController()
        script().afterAnswer.set("tool", () => dying.abort())

        await runs().advance(runId, dying.signal)

        expect(await statuses(runId)).toEqual(["turn:done", "door:done", "tool:done", "reply:pending"])
        expect(script().sent.size).toBe(0)
        const jobs = (await scene.jobs()).map((job) => job.dedupeKey)
        expect(jobs).toContain(`agent-step:${runId}:tool:done`)

        const job = world.resolve(AgentStepJobService)
        await job.run({ workspaceId: scene.workspaceId, runId })
        await job.run({ workspaceId: scene.workspaceId, runId })

        expect(await statuses(runId)).toEqual(ALL_DONE)
        expect(script().performed.filter((effect) => effect.startsWith("reply:"))).toEqual([`reply:${wakeId}`])
        expect(script().calls.get("reply")).toBe(1)
    })

    it("agent-runs/kill-before-reply: a reply sent and not stored is found sent on the retake, so it is not sent twice", async () => {
        const { runId, wakeId } = await scene.newRun("kill-after-reply")
        const hang = script().hangOnce("reply", "after")
        const dying = runs().advance(runId, SIGNAL)
        await hang.entered

        await scene.expireClaims(runId)
        await world.resolve(AgentRunSweepService).sweep()
        hang.release()
        await dying

        expect(await statuses(runId)).toEqual(ALL_DONE)
        expect(script().performed.filter((effect) => effect.startsWith("reply:"))).toEqual([`reply:${wakeId}`])
        expect(script().calls.get("reply")).toBe(2)
    })
})
