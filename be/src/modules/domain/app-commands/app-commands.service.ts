import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { AppCommandResult, OptionalAppCommand } from "./app-commands.contracts"
import { AppCommandEntity } from "./persistence/entities"

/** The states of a command that is still open to a job. */
const OPEN_STATES: Array<"queued" | "running"> = ["queued", "running"]

/** The longest error code the table keeps. */
const ERROR_CODE_MAX = 80

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The columns the claiming update hands back. */
interface BegunRow {
    readonly id: string
    readonly workspace_id: string | null
    readonly requested_by: string
    readonly kind: string
    readonly input: unknown
}

@Injectable()
/** The asks of the web app: the only writer of the state and result of public.app_commands. */
export class AppCommandsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Starts a command; null when it is unknown or already settled, so a repeated delivery changes nothing. */
    async begin(commandId: string): Promise<OptionalAppCommand> {
        const started = await this.entityManager
            .createQueryBuilder(AppCommandEntity, "ac")
            .update()
            .set({ state: "running" })
            .where({ id: commandId, state: In(OPEN_STATES) })
            .returning("id, workspace_id, requested_by, kind, input")
            .execute()
        const [row] = Array.isArray(started.raw) ? (started.raw as Array<BegunRow>) : []
        return row === undefined
            ? null
            : {
                  id: row.id,
                  workspaceId: row.workspace_id,
                  requestedBy: row.requested_by,
                  kind: row.kind,
                  input: isRecord(row.input) ? row.input : {},
              }
    }

    /** Settles the command as done and leaves its result for the asker. */
    async succeed(commandId: string, result: AppCommandResult): Promise<void> {
        await this.entityManager.update(
            AppCommandEntity,
            { id: commandId, state: In(OPEN_STATES) },
            { state: "done", result, errorCode: null, finishedAt: () => "now()" },
        )
    }

    /** Settles the command as failed with the error code the asker is shown. */
    async fail(commandId: string, code: string): Promise<void> {
        await this.entityManager.update(
            AppCommandEntity,
            { id: commandId, state: In(OPEN_STATES) },
            { state: "failed", errorCode: code.slice(0, ERROR_CODE_MAX), finishedAt: () => "now()" },
        )
    }
}
