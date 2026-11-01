import { AgentRunTraceService } from "../../../modules/domain/agent-runs/agent-run-trace.service"
import { AgentRunsService } from "../../../modules/domain/agent-runs/agent-runs.service"
import { AgentWakeService } from "../../../modules/domain/agent-work/agent-wake.service"
import {
    AgentRunEntity,
} from "../../../modules/domain/agent-runs/persistence/entities"
import { agentWakeOf } from "../../fixtures/builders/agent-work.builder"
import { persistOfficeRows } from "../../fixtures/builders/office-chain.builder"
import type { OfficeIdentity } from "../../fixtures/builders/office-chain.builder"
import { settleAgentWork, wakeOfFact } from "../../world/agent-work-database.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import type { useTestWorld } from "../../world/use-test-world"
import { specOf } from "../../world/agent-runs-script.service"
import { endBackoff, lapseClaims, removeStepJobs, stepJobsOf } from "../../world/agent-runs-database.service"
import type { StepSpec } from "../../../modules/domain/agent-runs/agent-runs.contracts"

/** The wake and run a proof drives. */
export interface Scene {
    /** The wake. */
    readonly wakeId: string
    /** The run. */
    readonly runId: string
}

/** What a proof needs of the office, the wake and the run of the agents' sagas, with the cleanup that leaves the database as it was. */
export const sceneOf = (world: ReturnType<typeof useTestWorld>) => {
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
            await removeWorkspace(em(), workspaceId)
            await removeAuthUsers(em(), Object.values(identity.users))
        })
        await persistOfficeRows(em(), identity)
    })

    afterEach(async () => {
        await em().delete(AgentRunEntity, { workspaceId })
        await removeStepJobs(em(), workspaceId)
        await settleAgentWork(em(), workspaceId)
    })

    /** Writes the wake of a tagged message, opens its run and adds the first steps (the turn by default): what the drain does for a wake on the new pipeline. */
    const newRun = async (label: string, first?: ReadonlyArray<StepSpec>): Promise<Scene> => {
        const eventKey = `${world.prefix}:${label}`
        const wake = agentWakeOf({
            workspaceId,
            agentId,
            source: "tag",
            eventKey,
            context: { room: "sales", authorUserId: identity.users.nam },
            actorMemberId: null,
        })
        await em().transaction((tx) => world.resolve(AgentWakeService).wake(tx, wake))
        const written = await wakeOfFact(em(), agentId, "tag", eventKey)
        const run = await em().transaction((tx) =>
            world.resolve(AgentRunsService).open(tx, {
                workspaceId,
                agentId,
                wakeId: written.id,
                trigger: "tag_message",
                versionId: null,
                context: { message: "hi", room: "sales" },
            }),
        )
        await em().transaction((tx) =>
            world
                .resolve(AgentRunsService)
                .append(tx, run.id, first ?? [specOf("turn", "turn", { kind: "read" }, { wakeId: written.id })]),
        )
        return { wakeId: written.id, runId: run.id }
    }

    return {
        workspaceId,
        agentId,
        newRun,
        /** Lets every claim of the run lapse, the way a worker that was killed leaves them. */
        expireClaims: (runId: string): Promise<void> => lapseClaims(em(), runId),
        /** Ends the backoff of the pending steps of the run. */
        endBackoff: (runId: string): Promise<void> => endBackoff(em(), runId),
        /** The steps of the run, in order, as the trace reads them. */
        stepsOf: (runId: string) => world.resolve(AgentRunTraceService).stepsOf(runId),
        /** The run row. */
        runRow: (runId: string) => em().findOneByOrFail(AgentRunEntity, { id: runId }),
        /** The advance jobs the outbox holds for the workspace. */
        jobs: () => stepJobsOf(em(), workspaceId),
    }
}
