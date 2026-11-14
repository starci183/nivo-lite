import { Injectable } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { AgentRunEntity, AgentRunStepEntity } from "./persistence/entities"

/** The core table a drain counts: the runs, or their steps. */
export type DrainTable = "agent_runs" | "agent_run_steps"

@Injectable()
/**
 * The read-only count of the runs and steps of a workspace that still stand in some statuses: what a verb that may only run on a drained
 * engine (`cli tools reseed`) asks before it writes. It reads, and writes nothing.
 */
export class AgentRunDrainService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** How many rows of the table, in the workspace, stand in one of the statuses. */
    countIn(workspaceId: string, table: DrainTable, statuses: ReadonlyArray<string>): Promise<number> {
        const where = { workspaceId, status: In([...statuses]) }
        return table === "agent_runs"
            ? this.entityManager.count(AgentRunEntity, { where })
            : this.entityManager.count(AgentRunStepEntity, { where })
    }
}
