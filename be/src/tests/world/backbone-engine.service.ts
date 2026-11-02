import { AgentRunsService } from "@modules/domain/agent-runs"
import { workspaceMembersEntities } from "@modules/domain/workspace-members"
import { AgentRunInflightService } from "../../modules/domain/agent-runs/agent-run-inflight.service"
import type { useTestWorld } from "./use-test-world"

/** The engine boundaries the failure proofs drive against the real store. */
export interface EnginePort {
    /** The runtime that answered the wake went down: the held step goes through the failure policy. */
    interrupted(wakeId: string, code: string, signal: AbortSignal): Promise<void>
    /** A person's verdict on a work item, inside its own transaction. False when no step waits on it. */
    decide(workItemId: string, approved: boolean): Promise<boolean>
    /** Graceful shutdown: stops taking steps and drains or releases the ones in flight. */
    shutdown(): Promise<void>
}

const [WorkspaceMemberEntity] = workspaceMembersEntities

/** Calls the real durable engine as the persisted owner of the proof workspace, including its shutdown lifecycle. */
export const backboneEngineOf = (world: ReturnType<typeof useTestWorld>, workspaceId: string): EnginePort => ({
    interrupted: (wakeId, code, signal) => world.resolve(AgentRunsService).interrupted(wakeId, code, signal),
    decide: async (workItemId, approved) => {
        const owner = await world.db.primary.findOneByOrFail(WorkspaceMemberEntity, { workspaceId, role: "owner" })
        return world.db.primary.transaction((tx) =>
            world.resolve(AgentRunsService).resumeWaiting(tx, workItemId, { approved, by: owner.id }),
        )
    },
    shutdown: () => world.resolve(AgentRunInflightService).beforeApplicationShutdown(),
})
