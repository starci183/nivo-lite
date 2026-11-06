import { AgentRunSweepService } from "../../../modules/domain/agent-runs/agent-run-sweep.service"
import { AgentRunsService } from "../../../modules/domain/agent-runs/agent-runs.service"
import { AgentWakeService } from "../../../modules/domain/agent-work/agent-wake.service"
import { agentWakeOf } from "../../fixtures/builders/agent-work.builder"
import { wakesOfFact } from "../../world/agent-work-database.service"
import { useTestWorld } from "../../world/use-test-world"
import { AGENT_RUNS_MODULES } from "../../world/agent-runs-capabilities.options"
import { ScriptedWorld, chainFrom, specOf } from "../../world/agent-runs-script.service"
import { sceneOf } from "@tests/world/agent-runs-scene.service"

const world = useTestWorld({ modules: AGENT_RUNS_MODULES })
const scene = sceneOf(world)

const script = () => world.resolve(ScriptedWorld)
const runs = () => world.resolve(AgentRunsService)
const SIGNAL = new AbortController().signal
const em = () => world.db.primary

beforeEach(() => script().reset())

const statuses = async (runId: string): Promise<ReadonlyArray<string>> =>
    (await scene.stepsOf(runId)).map((step) => `${step.stepKey}:${step.status}`)

describe("agent-runs/duplicate-webhook: the same fact arrives twice", () => {
    it("agent-runs/duplicate-webhook: one wake, one run and one set of steps, and two drivers at once act once", async () => {
        const eventKey = `${world.prefix}:duplicate`
        const wake = agentWakeOf({
            workspaceId: scene.workspaceId,
            agentId: scene.agentId,
            source: "tag",
            eventKey,
            context: { room: "sales" },
            actorMemberId: null,
        })

        const first = await em().transaction((tx) => world.resolve(AgentWakeService).wake(tx, wake))
        const second = await em().transaction((tx) => world.resolve(AgentWakeService).wake(tx, wake))

        expect([first, second]).toEqual([true, false])
        expect(await wakesOfFact(em(), scene.agentId, eventKey)).toBe(1)

        const { runId, wakeId } = await scene.newRun("duplicate-run")
        const again = await em().transaction((tx) =>
            runs().open(tx, {
                workspaceId: scene.workspaceId,
                agentId: scene.agentId,
                wakeId,
                trigger: "tag_message",
                versionId: null,
                context: { message: "again" },
            }),
        )
        await em().transaction((tx) =>
            runs().append(scene.workspaceId, tx, runId, [chainFrom("door", wakeId), chainFrom("door", wakeId)]),
        )

        expect(again.id).toBe(runId)
        expect(await statuses(runId)).toEqual(["turn:pending", "door:pending"])

        await Promise.all([
            runs().advance(scene.workspaceId, runId, SIGNAL),
            runs().advance(scene.workspaceId, runId, SIGNAL),
        ])
        await runs().advance(scene.workspaceId, runId, SIGNAL)

        expect(await statuses(runId)).toEqual(["turn:done", "door:done", "tool:done", "reply:done"])
        expect(script().performed).toEqual([`door:${wakeId}`, `tool:${wakeId}`, `reply:${wakeId}`])
    })

    it("agent-runs/duplicate-webhook: an inline tool call replayed answers the stored result and never calls the handler again", async () => {
        const { wakeId } = await scene.newRun("inline-replay")
        const spec = chainFrom("tool", wakeId)

        const first = await runs().runInline(scene.workspaceId, wakeId, spec, SIGNAL)
        const second = await runs().runInline(scene.workspaceId, wakeId, spec, SIGNAL)

        expect(second).toEqual(first)
        expect(script().calls.get("tool")).toBe(1)
        expect(script().performed).toEqual([`tool:${wakeId}`])
    })
})

describe("agent-runs/connector-timeout: the connector does not answer", () => {
    it("agent-runs/connector-timeout: the step is tried again after a backoff and the tool acts once", async () => {
        const { runId, wakeId } = await scene.newRun("timeout-then-ok")
        script().toolTries = [
            { kind: "retry", code: "connector_timeout" },
            { kind: "retry", code: "connector_timeout" },
        ]

        const held = await runs().advance(scene.workspaceId, runId, SIGNAL)
        expect(held.retryAfterMs).toBeNull()
        expect(await statuses(runId)).toEqual(["turn:done", "door:done", "tool:pending"])
        const waiting = await runs().advance(scene.workspaceId, runId, SIGNAL)
        expect(waiting.retryAfterMs).toBeGreaterThan(0)

        await scene.endBackoff(runId)
        await runs().advance(scene.workspaceId, runId, SIGNAL)
        await scene.endBackoff(runId)
        await runs().advance(scene.workspaceId, runId, SIGNAL)

        expect(await statuses(runId)).toEqual(["turn:done", "door:done", "tool:done", "reply:done"])
        expect((await scene.stepsOf(runId))[2]?.attempt).toBe(3)
        expect(script().performed).toEqual([`door:${wakeId}`, `tool:${wakeId}`, `reply:${wakeId}`])
    })

    it("agent-runs/connector-timeout: when the tries are spent the done steps are undone in reverse order, the reply is never sent and a person is told once", async () => {
        const { runId, wakeId } = await scene.newRun("timeout-for-good")
        script().toolTries = Array.from({ length: 5 }, () => ({ kind: "retry" as const, code: "connector_timeout" }))

        await runs().advance(scene.workspaceId, runId, SIGNAL)
        await scene.endBackoff(runId)
        await runs().advance(scene.workspaceId, runId, SIGNAL)
        await scene.endBackoff(runId)
        await runs().advance(scene.workspaceId, runId, SIGNAL)
        await world.resolve(AgentRunSweepService).sweep()

        expect(await scene.runRow(runId)).toMatchObject({ status: "compensated", error: { code: "connector_timeout" } })
        expect(script().performed).toEqual([`door:${wakeId}`, `undo:door:${wakeId}`])
        expect(script().sent.size).toBe(0)
        expect(script().told).toEqual(["tool:connector_timeout"])
        expect(await statuses(runId)).toEqual(["turn:done", "door:compensated", "tool:failed"])
    })

    it("agent-runs/connector-timeout: a failure after the reply was sent goes to a person and undoes nothing", async () => {
        const { runId } = await scene.newRun("after-pivot", [
            specOf("door", "door", { kind: "compensable", compensation: "undo_door" }),
            specOf("reply", "reply", { kind: "pivot" }),
            specOf("late", "late", { kind: "read" }),
        ])

        await runs().advance(scene.workspaceId, runId, SIGNAL)

        expect(script().performed).toEqual([`door:${runId}`, `reply:${runId}`])
        expect(await scene.runRow(runId)).toMatchObject({ status: "dead", error: { code: "late_failure" } })
        expect(script().told).toEqual(["late:late_failure"])
        expect(await statuses(runId)).toEqual(["door:done", "reply:done", "late:failed", "tool:pending"])
    })
})
