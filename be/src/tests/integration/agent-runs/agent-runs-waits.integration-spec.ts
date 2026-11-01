import { CLOCK } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { AgentRunSweepService } from "../../../modules/domain/agent-runs/agent-run-sweep.service"
import { AgentRunsService } from "../../../modules/domain/agent-runs/agent-runs.service"
import { AgentStepJobService } from "../../../modules/domain/agent-runs/agent-step-job.service"
import { useTestWorld } from "../../world/use-test-world"
import { AGENT_RUNS_MODULES } from "../../world/agent-runs-capabilities.options"
import { ScriptedTimeout, ScriptedVerdicts, ScriptedWorld, chainFrom, specOf } from "../../world/agent-runs-script.service"
import { sceneOf } from "./agent-runs.scene"

const world = useTestWorld({ modules: AGENT_RUNS_MODULES })
const scene = sceneOf(world)

const script = () => world.resolve(ScriptedWorld)
const timeout = () => world.resolve(ScriptedTimeout)
const runs = () => world.resolve(AgentRunsService)
const SIGNAL = new AbortController().signal
const em = () => world.db.primary

const HOUR_MS = 3_600_000

const after = (ms: number): Date => new Date(world.resolve<Clock>(CLOCK).now().getTime() + ms)

beforeEach(() => {
    script().reset()
    timeout().asked.length = 0
    timeout().answer = { kind: "ended" }
})

const statuses = async (runId: string): Promise<ReadonlyArray<string>> =>
    (await scene.stepsOf(runId)).map((step) => `${step.stepKey}:${step.status}`)

/** A run whose only step asks a person and waits for the item, until `deadline`. */
const askingRun = async (label: string, deadline: Date, kind = "ask") => {
    const itemId = world.id()
    const scened = await scene.newRun(label, [
        specOf("ask", kind, { kind: "read" }, { itemId, deadlineAt: deadline.toISOString() }),
    ])
    await runs().advance(scened.runId, SIGNAL)
    return { ...scened, itemId }
}

describe("agent-runs/wait-timeout: a wait step passes its deadline with no answer", () => {
    it("agent-runs/wait-timeout: the sweep hands it to the graph's timeout and, with nobody answering, stops the run visibly", async () => {
        const { runId, itemId } = await askingRun("wait-silence", after(-1000), "ask_plain")
        expect((await scene.runRow(runId)).status).toBe("waiting")

        await world.resolve(AgentRunSweepService).sweep()

        expect(timeout().asked).toEqual([itemId])
        expect((await scene.runRow(runId)).status).toBe("dead")
        expect((await scene.runRow(runId)).errorCode).toBe("wait_timeout")
        expect(script().told).toEqual(["ask:wait_timeout"])
        expect(await statuses(runId)).toEqual(["ask:failed"])

        await world.resolve(AgentRunSweepService).sweep()

        expect(script().told).toEqual(["ask:wait_timeout"])
    })

    it("agent-runs/wait-timeout: a backup group the graph asked keeps the wait going under a new deadline", async () => {
        const { runId, itemId } = await askingRun("wait-backup", after(-1000), "ask_plain")
        timeout().answer = { kind: "renewed", deadlineAt: after(HOUR_MS) }

        await world.resolve(AgentRunSweepService).sweep()
        await world.resolve(AgentRunSweepService).sweep()

        expect(timeout().asked).toEqual([itemId])
        expect((await scene.runRow(runId)).status).toBe("waiting")
        expect(await statuses(runId)).toEqual(["ask:running"])
        expect(script().told).toEqual([])
    })
})

describe("agent-runs/wait-answer: a person answers the work item", () => {
    it("agent-runs/wait-answer: the answer finishes the wait and writes the next step and its job in the decision's transaction, once", async () => {
        const { runId, itemId, wakeId } = await askingRun("wait-answer", after(HOUR_MS))
        const answer = { approved: true, by: "member-1" }

        const first = await em().transaction((tx) => runs().resumeWaiting(tx, itemId, answer))
        const second = await em().transaction((tx) => runs().resumeWaiting(tx, itemId, answer))

        expect([first, second]).toEqual([true, false])
        expect(await statuses(runId)).toEqual(["ask:done", "reply:pending"])
        expect((await scene.jobs()).map((job) => job.dedupeKey)).toContain(`agent-step:${runId}:${itemId}:resume`)

        const job = world.resolve(AgentStepJobService)
        await job.run({ workspaceId: scene.workspaceId, runId })
        await job.run({ workspaceId: scene.workspaceId, runId })

        expect(await statuses(runId)).toEqual(["ask:done", "reply:done"])
        expect(script().performed).toEqual([`reply:${wakeId}`])
        expect((await scene.runRow(runId)).status).toBe("done")
        expect(timeout().asked).toEqual([])
    })

    it("agent-runs/wait-answer: an answer for a work item no step waits on changes nothing", async () => {
        const { runId } = await askingRun("wait-other", after(HOUR_MS))

        const resumed = await em().transaction((tx) =>
            runs().resumeWaiting(tx, world.id(), { approved: true, by: "member-1" }),
        )

        expect(resumed).toBe(false)
        expect(await statuses(runId)).toEqual(["ask:running"])
    })
})
describe("agent-runs/wait-branch: a wait parks only its own branch", () => {
  it("agent-runs/wait-branch: the door still runs past an open approval, the run waits only when nothing else can run, and the answer finishes it", async () => {
    const itemId = world.id()
    const { runId, wakeId } = await scene.newRun("wait-branch", [
        specOf("ask", "ask", { kind: "read" }, { itemId, deadlineAt: after(HOUR_MS).toISOString() }),
        chainFrom("door", ""),
    ])

    await runs().advance(runId, SIGNAL)

    expect(await statuses(runId)).toEqual(["ask:running", "door:done", "tool:done", "reply:done"])
    expect((await scene.runRow(runId)).status).toBe("waiting")
    expect(script().performed).toEqual([`door:${runId}`, `tool:${runId}`, `reply:${runId}`])

    await em().transaction((tx) => runs().resumeWaiting(tx, itemId, { approved: false, by: "member-1" }))

    expect((await scene.runRow(runId)).status).toBe("done")
    expect(wakeId).toBeDefined()
  })
})

describe("agent-runs/kill-after-approval: the API dies after the item closed and before the wait was finished", () => {
  it("agent-runs/kill-after-approval: one sweep finishes the wait with the approval, never the timeout, and the reply is sent once", async () => {
    const { runId, itemId, wakeId } = await askingRun("kill-after-approval", after(-1000))
    world.resolve(ScriptedVerdicts).closed.set(itemId, { approved: true, by: "recovered" })

    await world.resolve(AgentRunSweepService).sweep()
    const job = world.resolve(AgentStepJobService)
    await job.run({ workspaceId: scene.workspaceId, runId })
    await job.run({ workspaceId: scene.workspaceId, runId })

    expect(timeout().asked).toEqual([])
    expect(await statuses(runId)).toEqual(["ask:done", "reply:done"])
    expect(script().performed).toEqual([`reply:${wakeId}`])
    expect(script().told).toEqual([])
  })
})
