import { jobsEntities } from "@modules/platform/jobs"
import { AgentRunSweepService } from "../../modules/domain/agent-runs/agent-run-sweep.service"
import { AgentRunsService } from "../../modules/domain/agent-runs/agent-runs.service"
import { AgentStepJobService } from "../../modules/domain/agent-runs/agent-step-job.service"
import { CLOCK, type Clock } from "@modules/platform/clock"
import { ScriptedWorld, specOf } from "./agent-runs-script.service"
import type { useTestWorld } from "./use-test-world"
import { sceneOf, type Scene } from "./agent-runs-scene.service"
import type { RunData } from "./agent-runs-database.service"
import type { Boundary, Chain, FailureCase, Fault, FaultKind } from "../fixtures/builders/backbone.builder"
import type { EnginePort } from "./backbone-engine.service"
import type { StepSpec, RunStepView } from "@modules/domain/agent-runs"

type JobOutboxEntity = InstanceType<(typeof jobsEntities)[1]>

const SIGNAL = new AbortController().signal

/** What an injector needs: the run, the scripted world the steps act on, and the engine calls. */
export interface Hurt {
    /** The run and its wake. */
    readonly scene: Scene
    /** The scene helpers (claims, backoff, trace). */
    readonly helpers: ReturnType<typeof sceneOf>
    /** The scripted world. */
    readonly script: ScriptedWorld
    /** The engine. */
    readonly runs: AgentRunsService
    /** The real engine's interruption, decision and shutdown boundaries. */
    readonly engine: EnginePort
    /** The work item an approval chain waits on. */
    readonly itemId: string
    /** Lets the claims lapse and runs the sweep, the way the minute sweep finds a worker that is gone. */
    readonly sweep: () => Promise<void>
    /** Opens the same wake again, as a redelivery does. */
    readonly repeat: () => Promise<Scene>
}

type Injector = (hurt: Hurt, fault: Fault) => Promise<void>

type Injectors = { readonly [K in FaultKind]: Injector }

const TURN: Boundary = { handler: "turn", phase: "before" }

const killedAt = async (hurt: Hurt, { handler, phase }: Boundary): Promise<void> => {
    const hang = hurt.script.hangOnce(handler, phase)
    const dying = hurt.runs.advance(hurt.helpers.workspaceId, hurt.scene.runId, SIGNAL)
    await hang.entered
    await hurt.sweep()
    hang.release()
    await dying
}

const approve = async (hurt: Hurt): Promise<void> => {
    await hurt.runs.advance(hurt.helpers.workspaceId, hurt.scene.runId, SIGNAL)
    expect(await hurt.engine.decide(hurt.itemId, true)).toBe(true)
}

const INJECTORS: Injectors = {
    "hang-kill": (hurt, fault) => killedAt(hurt, fault.at ?? TURN),
    "abort-after": async (hurt, fault) => {
        const dying = new AbortController()
        hurt.script.afterAnswer.set((fault.at ?? TURN).handler, () => dying.abort())
        await hurt.runs.advance(hurt.helpers.workspaceId, hurt.scene.runId, dying.signal)
    },
    "kill-after-approval": async (hurt) => {
        await approve(hurt)
        await killedAt(hurt, { handler: "reply", phase: "before" })
    },
    "runtime-down": async (hurt) => {
        const hang = hurt.script.hangOnce("turn", "before")
        const dying = hurt.runs.advance(hurt.helpers.workspaceId, hurt.scene.runId, SIGNAL)
        await hang.entered
        await hurt.engine.interrupted(hurt.scene.wakeId, "runtime_down", SIGNAL)
        hang.release()
        await dying
    },
    "tool-unknown": async (hurt) => {
        hurt.script.started.add(`tool:${hurt.scene.wakeId}`)
        await hurt.runs.advance(hurt.helpers.workspaceId, hurt.scene.runId, SIGNAL)
    },
    "duplicate-message": async (hurt) => {
        const again = await hurt.repeat()
        expect(again).toEqual(hurt.scene)
        await Promise.all([
            hurt.runs.advance(hurt.helpers.workspaceId, hurt.scene.runId, SIGNAL),
            hurt.runs.advance(hurt.helpers.workspaceId, hurt.scene.runId, SIGNAL),
        ])
    },
    "double-approval": async (hurt) => {
        await approve(hurt)
        expect(await hurt.engine.decide(hurt.itemId, true)).toBe(false)
    },
    "connector-timeout": async (hurt) => {
        hurt.script.toolTries = [{ kind: "retry", code: "connector_timeout" }]
        await hurt.runs.advance(hurt.helpers.workspaceId, hurt.scene.runId, SIGNAL)
        expect(
            (await hurt.helpers.stepsOf(hurt.scene.runId)).map((step) => `${step.stepKey}:${step.status}`),
        ).toContain("tool:pending")
    },
    reload: async (hurt) => {
        const dying = new AbortController()
        hurt.script.afterAnswer.set("door", () => dying.abort())
        await hurt.runs.advance(hurt.helpers.workspaceId, hurt.scene.runId, dying.signal)
        const before = await hurt.helpers.stepsOf(hurt.scene.runId)
        const reloaded = await hurt.repeat()
        expect(reloaded).toEqual(hurt.scene)
        expect(await hurt.helpers.stepsOf(hurt.scene.runId)).toEqual(before)
    },
    "graceful-shutdown": async (hurt) => {
        const hang = hurt.script.hangOnce("turn", "before")
        const draining = hurt.runs.advance(hurt.helpers.workspaceId, hurt.scene.runId, SIGNAL)
        await hang.entered
        const closing = hurt.engine.shutdown()
        hang.release()
        await draining
        await closing
    },
}

const HOUR_MS = 3_600_000

const FIRST: Readonly<
    Record<
        Chain,
        (wakeId: string, itemId: string, deadlineAt: string) => ReadonlyArray<ReturnType<typeof specOf>> | undefined
    >
> = {
    customer: () => undefined,
    approval: (wakeId, itemId, deadlineAt) => [specOf("ask", "ask", { kind: "read" }, { wakeId, itemId, deadlineAt })],
}

type BackboneOfResultHelpersShape = {
    workspaceId: string
    agentId: string
    newRun: (label: string, first?: ReadonlyArray<StepSpec>) => Promise<Scene>
    expireClaims: (runId: string) => Promise<void>
    endBackoff: (runId: string) => Promise<void>
    stepsOf: (runId: string) => Promise<ReadonlyArray<RunStepView>>
    runRow: (runId: string) => Promise<RunData>
    jobs: () => Promise<Array<JobOutboxEntity>>
}

type BackboneOfResultShape = {
    helpers: BackboneOfResultHelpersShape
    /** Runs one row: the run, the fault, the recovery the product has, and the checks. */
    run(row: FailureCase): Promise<void>
}

/** Opens the harness of a suite: a run, a fault injected at a step boundary of the real engine, and the checks every row makes. */
export const backboneOf = (
    world: ReturnType<typeof useTestWorld>,
    engineOf: (workspaceId: string) => EnginePort,
): BackboneOfResultShape => {
    const helpers = sceneOf(world)
    const engine = engineOf(helpers.workspaceId)
    const script = () => world.resolve(ScriptedWorld)
    beforeEach(() => script().reset())

    const verify = async (row: FailureCase, runId: string): Promise<void> => {
        const steps = await helpers.stepsOf(runId)
        const run = await helpers.runRow(runId)
        const performed = script().performed
        expect(steps.map((step) => `${step.stepKey}:${step.status}`)).toEqual(row.expected.steps)
        expect(run.status).toBe(row.expected.runStatus)
        for (const [prefix, count] of Object.entries(row.expected.effects)) {
            expect(performed.filter((effect) => effect.startsWith(`${prefix}:`))).toHaveLength(count)
        }
        expect(script().told).toEqual(row.expected.told)
        expect(steps.findLast((step) => step.status === "done")?.nodeKey).toBe(row.expected.reached)
    }

    return {
        helpers,
        /** Runs one row: the run, the fault, the recovery the product has, and the checks. */
        async run(row: FailureCase): Promise<void> {
            const itemId = world.id()
            const label = row.id
            const anchor = world.id()
            const deadlineAt = new Date(world.resolve<Clock>(CLOCK).now().getTime() + HOUR_MS).toISOString()
            const first = () => FIRST[row.chain](anchor, itemId, deadlineAt)
            const scene = await helpers.newRun(label, first())
            const hurt: Hurt = {
                scene,
                helpers,
                script: script(),
                runs: world.resolve(AgentRunsService),
                engine,
                itemId,
                sweep: () =>
                    helpers
                        .expireClaims(scene.runId)
                        .then(() => world.resolve(AgentRunSweepService).sweep())
                        .then(() => undefined),
                repeat: () => helpers.newRun(label, first()),
            }
            await INJECTORS[row.fault.kind](hurt, row.fault)
            await recover(hurt, world)
            await verify(row, scene.runId)
        },
    }
}

const recover = async (hurt: Hurt, world: ReturnType<typeof useTestWorld>): Promise<void> => {
    await hurt.helpers.endBackoff(hurt.scene.runId)
    await world.resolve(AgentStepJobService).run({ workspaceId: hurt.helpers.workspaceId, runId: hurt.scene.runId })
    await world.resolve(AgentStepJobService).run({ workspaceId: hurt.helpers.workspaceId, runId: hurt.scene.runId })
    await hurt.sweep()
}
