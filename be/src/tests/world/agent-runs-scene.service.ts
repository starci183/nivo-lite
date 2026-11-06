import { jobsEntities } from "@modules/platform/jobs"
import { AgentRunTraceService } from "../../modules/domain/agent-runs/agent-run-trace.service"
import { AgentRunsService } from "../../modules/domain/agent-runs/agent-runs.service"
import { AgentWakeService } from "../../modules/domain/agent-work/agent-wake.service"
import { agentWakeOf } from "../fixtures/builders/agent-work.builder"
import { persistOfficeRows } from "../fixtures/builders/office-chain.builder"
import type { OfficeIdentity } from "../fixtures/builders/office-chain.builder"
import { settleAgentWork, wakeOfFact } from "./agent-work-database.service"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"
import { removeAuthUsers, removeWorkspace } from "./proof-accounts.service"
import type { useTestWorld } from "./use-test-world"
import { specOf } from "./agent-runs-script.service"
import {
    endBackoff,
    lapseClaims,
    removeRunRecords,
    removeStepJobs,
    runDataOf,
    stepJobsOf,
} from "./agent-runs-database.service"
import type { RunData } from "./agent-runs-database.service"
import type { StepSpec } from "../../modules/domain/agent-runs/agent-runs.contracts"
import type { RunStepView } from "@modules/domain/agent-runs"

type JobOutboxEntity = InstanceType<(typeof jobsEntities)[1]>

/** The wake and run a proof drives. */
export interface Scene {
    /** The wake. */
    readonly wakeId: string
    /** The run. */
    readonly runId: string
}

type SceneOfResultShape = {
    workspaceId: string
    agentId: string
    newRun: (label: string, first?: ReadonlyArray<StepSpec>) => Promise<Scene>
    /** Lets every claim of the run lapse, the way a worker that was killed leaves them. */
    expireClaims: (runId: string) => Promise<void>
    /** Ends the backoff of the pending steps of the run. */
    endBackoff: (runId: string) => Promise<void>
    /** The steps of the run, in order, as the trace reads them. */
    stepsOf: (runId: string) => Promise<ReadonlyArray<RunStepView>>
    /** The declared fields of the run record. */
    runRow: (runId: string) => Promise<RunData>
    /** The advance jobs the outbox holds for the workspace. */
    jobs: () => Promise<Array<JobOutboxEntity>>
}

/** Writes the wake of a tagged message, opens its run and adds the first steps (the turn by default): what the drain does for a wake on the new pipeline. */
const openRun = async (
    world: ReturnType<typeof useTestWorld>,
    identity: OfficeIdentity,
    label: string,
    first?: ReadonlyArray<StepSpec>,
): Promise<Scene> => {
    const { workspaceId } = identity
    const agentId = identity.agents.sales
    const em = world.db.primary
    const eventKey = `${world.prefix}:${label}`
    const wake = agentWakeOf({
        workspaceId,
        agentId,
        source: "tag",
        eventKey,
        context: { room: "sales", authorUserId: identity.users.nam },
        actorMemberId: null,
    })
    await em.transaction((tx) => world.resolve(AgentWakeService).wake(tx, wake))
    const written = await wakeOfFact(em, agentId, "tag", eventKey)
    const run = await em.transaction((tx) =>
        world.resolve(AgentRunsService).open(tx, {
            workspaceId,
            agentId,
            wakeId: written.id,
            trigger: "tag_message",
            versionId: null,
            context: { message: "hi", room: "sales" },
        }),
    )
    const steps = first ?? [specOf("turn", "turn", { kind: "read" }, { wakeId: written.id })]
    await em.transaction((tx) => world.resolve(AgentRunsService).append(workspaceId, tx, run.id, steps))
    return { wakeId: written.id, runId: run.id }
}

/** What a proof needs of the office, the wake and the run of the agents' sagas, with the cleanup that leaves the database as it was. */
export const sceneOf = (world: ReturnType<typeof useTestWorld>): SceneOfResultShape => {
    const identity: OfficeIdentity = {
        workspaceId: world.id(),
        users: { nam: world.id(), minh: world.id(), ha: world.id(), van: world.id(), lan: world.id() },
        agents: { sales: world.id(), accounting: world.id(), care: world.id() },
    }
    const workspaceId = identity.workspaceId
    const agentId = identity.agents.sales
    const em = () => world.db.primary

    beforeAll(async () => {
        world.cleanup(async () => {
            await removeStepJobs(em(), workspaceId)
            await removeRunRecords(em(), workspaceId)
            await removeWorkspace(em(), workspaceId)
            await removeAuthUsers(em(), Object.values(identity.users))
        })
        await persistOfficeRows(em(), identity)
    })

    afterEach(async () => {
        await removeRunRecords(em(), workspaceId)
        await removeStepJobs(em(), workspaceId)
        await settleAgentWork(em(), workspaceId)
    })

    const newRun = (label: string, first?: ReadonlyArray<StepSpec>): Promise<Scene> =>
        openRun(world, identity, label, first)

    return {
        workspaceId,
        agentId,
        newRun,
        /** Lets every claim of the run lapse, the way a worker that was killed leaves them. */
        expireClaims: (runId: string): Promise<void> => lapseClaims(world, workspaceId, runId),
        /** Ends the backoff of the pending steps of the run. */
        endBackoff: (runId: string): Promise<void> => endBackoff(world, workspaceId, runId),
        /** The steps of the run, in order, as the trace reads them. */
        stepsOf: (runId: string): Promise<ReadonlyArray<RunStepView>> =>
            world.resolve(AgentRunTraceService).stepsOf(workspaceId, runId),
        /** The declared fields of the run record. */
        runRow: async (runId: string): Promise<RunData> => {
            const data = await runDataOf(world, workspaceId, runId)
            if (data === null) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing })
            return data
        },
        /** The advance jobs the outbox holds for the workspace. */
        jobs: (): Promise<Array<JobOutboxEntity>> => stepJobsOf(em(), workspaceId),
    }
}
