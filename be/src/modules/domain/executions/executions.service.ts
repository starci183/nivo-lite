import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { NewExecution } from "./executions.contracts"
import { ExecutionsError, ExecutionsErrorCode } from "./errors/executions.error"
import type { ExecutionIdRow } from "./persistence/executions.rows"
import { INSERT_EXECUTION } from "./persistence/executions.sql"

@Injectable()
/** The approval cards of drafts: the only writer of public.executions. */
export class ExecutionsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Creates the approval card of a draft and answers its id. */
    async open(card: NewExecution): Promise<string> {
        const row = (
            await this.entityManager.query<Array<ExecutionIdRow>>(INSERT_EXECUTION, [
                card.workspaceId,
                card.responsibilityId,
                card.agentId,
                card.draft,
                card.workItemId,
            ])
        )[0]
        if (row === undefined) throw new ExecutionsError({ code: ExecutionsErrorCode.NotCreated })
        return row.id
    }
}
