import { AgentRunsService } from "../../../modules/domain/agent-runs/agent-runs.service"
import { useTestWorld } from "../../world/use-test-world"
import { AGENT_RUNS_MODULES } from "../../world/agent-runs-capabilities.options"
import { stepRecordsOf } from "../../world/agent-runs-database.service"
import { changeRecord, removeRecord, versionOf } from "../../world/entity-engine-records.service"
import { withBackendTransaction } from "../../world/entity-engine-scope-proof.service"
import { TestWorldError, TestWorldErrorCode } from "../../world/test-world.error"
import { sceneOf } from "@tests/world/agent-runs-scene.service"

const world = useTestWorld({ modules: AGENT_RUNS_MODULES })
const scene = sceneOf(world)

/** The entity of a run. */
const RUN = "agent.run"

/** The entity of a step. */
const STEP = "agent.run-step"

describe("agent-runs/isolation: a run and its steps belong to their workspace", () => {
    it("agent-runs/isolation: another workspace's scope cannot see, change or delete the run or its step, and the owner's scope sees both", async () => {
        const { runId } = await scene.newRun("isolation-records")
        const [step] = await stepRecordsOf(world, scene.workspaceId, runId)
        if (step === undefined) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing })
        const stranger = world.id()

        await withBackendTransaction(world, async (probe) => {
            await probe.enter(stranger)
            expect(await versionOf(probe.manager, RUN, runId)).toBeNull()
            expect(await versionOf(probe.manager, STEP, step.id)).toBeNull()
            expect(await changeRecord(probe.manager, STEP, step.id, step.version, {})).toBe(0)
            expect(await removeRecord(probe.manager, STEP, step.id)).toBe(0)
            expect(await removeRecord(probe.manager, RUN, runId)).toBe(0)
        })

        await withBackendTransaction(world, async (probe) => {
            await probe.enter(scene.workspaceId)
            expect(await versionOf(probe.manager, RUN, runId)).not.toBeNull()
            expect(await versionOf(probe.manager, STEP, step.id)).toBe(step.version)
        })
    })

    it("agent-runs/isolation: the capability answers no run for a workspace that does not own it", async () => {
        const { runId } = await scene.newRun("isolation-capability")

        await expect(world.resolve(AgentRunsService).runOf(world.id(), runId)).resolves.toBeNull()
        await expect(world.resolve(AgentRunsService).runOf(scene.workspaceId, runId)).resolves.toMatchObject({
            id: runId,
            workspaceId: scene.workspaceId,
        })
    })
})
