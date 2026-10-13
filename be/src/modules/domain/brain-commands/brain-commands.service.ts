import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { CommandResult, MaybeCommand } from "./brain-commands.contracts"
import type { BrainCommandRow, CommandIdRow } from "./persistence/brain-commands.rows"
import { BEGIN_COMMAND, FAIL_COMMAND, FINISH_COMMAND, SELECT_COMMAND } from "./persistence/brain-commands.sql"

@Injectable()
/** The commands people ask the back end to carry out: a worker takes one, and closes it with a result or a stored code. */
export class BrainCommandsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The command, when it is there. */
    async get(workspaceId: string, id: string): Promise<MaybeCommand> {
        const [row] = await this.entityManager.query<Array<BrainCommandRow>>(SELECT_COMMAND, [workspaceId, id])
        if (row === undefined) return null
        return {
            id: row.id,
            workspaceId: row.workspace_id,
            requestedBy: row.requested_by,
            kind: row.kind,
            payload: row.payload,
            status: row.status,
        }
    }

    /** Takes the command for this worker; false when it is closed already. */
    async begin(workspaceId: string, id: string): Promise<boolean> {
        const rows = await this.entityManager.query<Array<CommandIdRow>>(BEGIN_COMMAND, [workspaceId, id])
        return rows.length > 0
    }

    /** Closes the command as done with what it produced. */
    async finish(workspaceId: string, id: string, result: CommandResult): Promise<void> {
        await this.entityManager.query(FINISH_COMMAND, [workspaceId, id, JSON.stringify(result)])
    }

    /** Closes the command as failed with the stored code of the cause. */
    async fail(workspaceId: string, id: string, code: string): Promise<void> {
        await this.entityManager.query(FAIL_COMMAND, [workspaceId, id, code])
    }
}
