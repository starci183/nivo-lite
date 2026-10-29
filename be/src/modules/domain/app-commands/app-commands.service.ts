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

@Injectable()
/** The asks of the web app: the only writer of the state and result of public.app_commands. */
export class AppCommandsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Starts a command; null when it is unknown or already settled, so a repeated delivery changes nothing. */
    async begin(commandId: string): Promise<OptionalAppCommand> {
        const claimed = await this.entityManager.update(
            AppCommandEntity,
            { id: commandId, state: In(OPEN_STATES) },
            { state: "running" },
        )
        if (claimed.affected !== 1) return null
        const row = await this.entityManager.findOne(AppCommandEntity, { where: { id: commandId } })
        return row === null
            ? null
            : {
                  id: row.id,
                  workspaceId: row.workspaceId,
                  requestedBy: row.requestedBy,
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
