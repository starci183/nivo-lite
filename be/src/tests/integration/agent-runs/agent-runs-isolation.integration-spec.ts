import { entityEngineEntities } from "@modules/domain/entity-engine"
import { AgentRunsService } from "../../../modules/domain/agent-runs/agent-runs.service"
import { persistOfficeRows } from "../../fixtures/builders/office-chain.builder"
import type { OfficeIdentity } from "../../fixtures/builders/office-chain.builder"
import { saveRecord } from "../../fixtures/builders/sales-door.builder"
import { useTestWorld } from "../../world/use-test-world"
import { AGENT_RUNS_MODULES } from "../../world/agent-runs-capabilities.options"
import { changeRecord, removeRecord, versionOf } from "../../world/entity-engine-records.service"
import { withBackendTransaction } from "../../world/entity-engine-scope-proof.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { TestWorldError, TestWorldErrorCode } from "../../world/test-world.error"

// A run record and its step records belong to their workspace. Phase 3 (package X2): the old kernel and its scene are gone, so the rows
// are seeded the way the thread projection and the run store leave them (a `running` thread run and its `done` step), directly in the
// records as the world's superuser; what is proved is the row-level scope of those kept records and the run read that stays.

const world = useTestWorld({ modules: AGENT_RUNS_MODULES })

const [RecordEntity] = entityEngineEntities

/** The entity of a run. */
const RUN = "agent.run"

/** The entity of a step. */
const STEP = "agent.run-step"

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

/** A thread run of the sales agent and its first step, as the records hold them; answers the two ids. */
const seededRun = async (): Promise<{ readonly runId: string; readonly stepId: string }> => {
    const runId = world.id()
    const stepId = world.id()
    const at = "2026-11-11T09:00:00.000Z"
    await saveRecord(world.db.primary, workspaceId, RUN, runId, {
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
    await saveRecord(world.db.primary, workspaceId, STEP, stepId, {
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
        compAttempts: 0,
        deadlineMs: 30000,
        doorCalls: { calls: [] },
    })
    return { runId, stepId }
}

/** The version of a record as the superuser reads it. */
const storedVersionOf = async (entity: string, id: string): Promise<string> => {
    const row = await world.db.primary.findOneBy(RecordEntity, { workspaceId, entity, id })
    if (row === null) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing })
    return row.version
}

describe("agent-runs/isolation: a run and its steps belong to their workspace", () => {
    it("agent-runs/isolation: another workspace's scope cannot see, change or delete the run or its step, and the owner's scope sees both", async () => {
        const { runId, stepId } = await seededRun()
        const stepVersion = await storedVersionOf(STEP, stepId)
        const stranger = world.id()

        await withBackendTransaction(world, async (probe) => {
            await probe.enter(stranger)
            expect(await versionOf(probe.manager, RUN, runId)).toBeNull()
            expect(await versionOf(probe.manager, STEP, stepId)).toBeNull()
            expect(await changeRecord(probe.manager, STEP, stepId, stepVersion, {})).toBe(0)
            expect(await removeRecord(probe.manager, STEP, stepId)).toBe(0)
            expect(await removeRecord(probe.manager, RUN, runId)).toBe(0)
        })

        await withBackendTransaction(world, async (probe) => {
            await probe.enter(workspaceId)
            expect(await versionOf(probe.manager, RUN, runId)).not.toBeNull()
            expect(await versionOf(probe.manager, STEP, stepId)).toBe(stepVersion)
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
