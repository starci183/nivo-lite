import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { AppCommandResult, OptionalAppCommand } from "./app-commands.contracts"
import type { AppCommandRow } from "./persistence/app-commands.rows"
import { BEGIN_COMMAND, FAIL_COMMAND, SUCCEED_COMMAND } from "./persistence/app-commands.sql"

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

@Injectable()
/** The asks of the web app: the only writer of the state and result of public.app_commands. */
export class AppCommandsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Starts a command; null when it is unknown or already settled, so a repeated delivery changes nothing. */
    async begin(commandId: string): Promise<OptionalAppCommand> {
        const [row] = await this.entityManager.query<Array<AppCommandRow>>(BEGIN_COMMAND, [commandId])
        if (row === undefined) return null
        return {
            id: row.id,
            workspaceId: row.workspace_id,
            requestedBy: row.requested_by,
            kind: row.kind,
            input: isRecord(row.input) ? row.input : {},
        }
    }

    /** Settles the command as done and leaves its result for the asker. */
    async succeed(commandId: string, result: AppCommandResult): Promise<void> {
        await this.entityManager.query(SUCCEED_COMMAND, [commandId, JSON.stringify(result)])
    }

    /** Settles the command as failed with the error code the asker is shown. */
    async fail(commandId: string, code: string): Promise<void> {
        await this.entityManager.query(FAIL_COMMAND, [commandId, code])
    }
}
