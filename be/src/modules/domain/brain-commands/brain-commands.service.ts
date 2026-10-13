import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { KNOWLEDGE_QUEUE, KnowledgeJob, knowledgeDedupeKey } from "@modules/queues/knowledge"
import type { CommandResult, MaybeCommand, MaybeCommandState } from "./brain-commands.contracts"
import type { BrainCommandRow, CommandIdRow, CommandStateRow } from "./persistence/brain-commands.rows"
import {
    BEGIN_COMMAND,
    FAIL_COMMAND,
    FINISH_COMMAND,
    INSERT_COMMAND,
    SELECT_COMMAND,
    SELECT_COMMAND_STATE,
} from "./persistence/brain-commands.sql"

@Injectable()
/** The commands people ask the back end to carry out: a worker takes one, and closes it with a result or a stored code. */
export class BrainCommandsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
    ) {}

    /** A member asks for a command: the row and its job are written in one transaction; the job proves the role the command needs again. Answers the command id. */
    async request(userId: string, workspaceId: string, kind: string, payload: object): Promise<string> {
        await this.members.require(userId, workspaceId)
        return this.entityManager.transaction(async (tx) => {
            const rows = await tx.query<Array<CommandIdRow>>(INSERT_COMMAND, [
                workspaceId,
                userId,
                kind,
                JSON.stringify(payload),
            ])
            const id = rows.map((row) => row.id).join("")
            await this.outbox.write(
                tx,
                KNOWLEDGE_QUEUE,
                { commandId: id, workspaceId },
                { job: KnowledgeJob.BrainCommand, dedupeKey: knowledgeDedupeKey(KnowledgeJob.BrainCommand, id) },
            )
            return id
        })
    }

    /** How a command stands for the person who asked; null when they asked no such command. */
    async stateOf(userId: string, workspaceId: string, id: string): Promise<MaybeCommandState> {
        const [row] = await this.entityManager.query<Array<CommandStateRow>>(SELECT_COMMAND_STATE, [
            workspaceId,
            id,
            userId,
        ])
        return row === undefined ? null : { status: row.status, result: row.result, errorCode: row.error_code }
    }

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
