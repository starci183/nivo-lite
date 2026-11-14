import { AgentRunEntity, AgentRunStepEntity } from "../../../modules/domain/agent-runs/persistence/entities"
import { AgentRunsService } from "../../../modules/domain/agent-runs/agent-runs.service"
import { persistOfficeRows, type OfficeIdentity } from "../../fixtures/builders/office-chain.builder"
import { useTestWorld } from "../../world/use-test-world"
import { AGENT_RUNS_MODULES } from "../../world/agent-runs-capabilities.options"
import { withBackendTransaction } from "../../world/entity-engine-scope-proof.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { TestWorldError, TestWorldErrorCode } from "../../world/test-world.error"

// A run and its steps belong to their workspace: the core tables `agent_runs` and `agent_run_steps`. The rows are seeded the way the
// thread projection and the run store leave them (a `running` thread run and its `done` step), as the world's superuser; what is proved
// is the row-level scope of those rows inside the engine's scope (role `app_engine`, the workspace of the scope) and the run read.

const world = useTestWorld({ modules: AGENT_RUNS_MODULES })

const identity: OfficeIdentity = {
    workspaceId: world.id(),
    users: { nam: world.id(), minh: world.id(), ha: world.id(), van: world.id(), lan: world.id() },
    agents: { sales: world.id(), accounting: world.id(), care: world.id() },
}
const { workspaceId } = identity

beforeAll(async () => {
    world.cleanup(async () => {
        await removeWorkspace(world.db.primary, workspaceId)
        await removeAuthUsers(world.db.primary, Object.values(identity.users))
    })
    await persistOfficeRows(world.db.primary, identity)
})

/** A thread run of the sales agent and its first step, as the tables hold them; answers the two ids. */
const seededRun = async (): Promise<{ readonly runId: string; readonly stepId: string }> => {
    const runId = world.id()
    const stepId = world.id()
    const at = new Date("2026-11-11T09:00:00.000Z")
    await world.db.primary.save(AgentRunEntity, {
        id: runId,
        workspaceId,
        agentId: identity.agents.sales,
        wakeId: world.id(),
        trigger: "graph_flow",
        planning: false,
        status: "running",
        engine: "langgraph",
        context: { conversationId: "conv-1" },
        resumeAttempts: 0,
        stepSeq: 1,
        startedAt: at,
    })
    await world.db.primary.save(AgentRunStepEntity, {
        id: stepId,
        workspaceId,
        runId,
        ordinal: 1,
        stepKey: "consult",
        nodeKey: "sales.consult-turn",
        kind: "node",
        effect: { kind: "read" },
        input: {},
        status: "done",
        attempt: 1,
        maxAttempts: 1,
        deadlineMs: 30000,
        doorCalls: { calls: [] },
    })
    return { runId, stepId }
}

/** The version of a step as the superuser reads it. */
const storedVersionOf = async (id: string): Promise<number> => {
    const row = await world.db.primary.findOneBy(AgentRunStepEntity, { workspaceId, id })
    if (row === null) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing })
    return row.version
}

describe("agent-runs/isolation: a run and its steps belong to their workspace", () => {
    it("agent-runs/isolation: another workspace's scope cannot see, change or delete the run or its step, and the owner's scope sees both", async () => {
        const { runId, stepId } = await seededRun()
        const stepVersion = await storedVersionOf(stepId)
        const stranger = world.id()

        await withBackendTransaction(world, async (probe) => {
            await probe.enter(stranger)
            expect(await probe.manager.findOneBy(AgentRunEntity, { id: runId })).toBeNull()
            expect(await probe.manager.findOneBy(AgentRunStepEntity, { id: stepId })).toBeNull()
            expect((await probe.manager.update(AgentRunStepEntity, { id: stepId, version: stepVersion }, { status: "failed" })).affected).toBe(0)
            expect((await probe.manager.delete(AgentRunStepEntity, { id: stepId })).affected).toBe(0)
            expect((await probe.manager.delete(AgentRunEntity, { id: runId })).affected).toBe(0)
        })

        await withBackendTransaction(world, async (probe) => {
            await probe.enter(workspaceId)
            expect(await probe.manager.findOneBy(AgentRunEntity, { id: runId })).not.toBeNull()
            expect((await probe.manager.findOneBy(AgentRunStepEntity, { id: stepId }))?.version).toBe(stepVersion)
        })
    })

    it("agent-runs/isolation: the capability answers no run for a workspace that does not own it", async () => {
        const { runId } = await seededRun()

        await expect(world.resolve(AgentRunsService).runOf(world.id(), runId)).resolves.toBeNull()
        await expect(world.resolve(AgentRunsService).runOf(workspaceId, runId)).resolves.toMatchObject({
            id: runId,
            workspaceId,
        })
    })
})
