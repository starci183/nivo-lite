import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { DomainError } from "@modules/platform/errors"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { isShiftsCommandPayload } from "@modules/queues/shifts-command"
import { ShiftsImportService } from "./shifts-import.service"
import { ShiftsRequestsService } from "./shifts-requests.service"
import { ShiftsScheduleService } from "./shifts-schedule.service"
import { ShiftsLogEvent } from "./shifts.log-events"
import { decodeCommand } from "./policies/command-input.policy"
import type { ShiftsCommandRequest } from "./policies/command-input.policy"
import { FINISH_COMMAND, SELECT_COMMAND } from "./persistence/shifts.sql"
import type { ShiftsCommandsRow } from "./persistence/shifts.rows"

/** The code a command that failed without a refusal in words is settled with. */
const COMMAND_FAILED_CODE = "SHIFTS_COMMAND_FAILED"

/** What one settled command stores: its status, result and refusal. */
interface Settlement {
    readonly status: "done" | "failed"
    readonly result: object | null
    readonly code: string | null
    readonly message: string | null
}

@Injectable()
/** Runs the commands members submit from the web app: each runs through the domain service it names, as the member who submitted it, and the answer is written back on the command row. */
export class ShiftsCommandService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        private readonly schedule: ShiftsScheduleService,
        private readonly requests: ShiftsRequestsService,
        private readonly importing: ShiftsImportService,
    ) {}

    /** The effect of one shifts-command job; a payload of any other job changes nothing. */
    async runJob(payload: object): Promise<void> {
        if (isShiftsCommandPayload(payload)) await this.run(payload.commandId, payload.workspaceId)
    }

    /** Runs one queued command and settles it; a command already settled, or unknown, changes nothing. */
    async run(commandId: string, workspaceId: string): Promise<void> {
        const [row] = await this.entityManager.query<Array<ShiftsCommandsRow>>(SELECT_COMMAND, [commandId, workspaceId])
        if (row === undefined || row.status !== "queued") return
        const settlement = await this.settle(row)
        await this.entityManager.query(FINISH_COMMAND, [
            row.id,
            settlement.status,
            settlement.result === null ? null : JSON.stringify(settlement.result),
            settlement.code,
            settlement.message,
        ])
    }

    private async settle(row: ShiftsCommandsRow): Promise<Settlement> {
        try {
            const request = decodeCommand(row.kind, row.input)
            if (request === null) return this.failed(COMMAND_FAILED_CODE, {})
            return {
                status: "done",
                result: await this.execute(request, row.created_by, row.workspace_id),
                code: null,
                message: null,
            }
        } catch (cause) {
            if (cause instanceof DomainError) return this.failed(cause.code, cause.params)
            this.logger.error(ShiftsLogEvent.CommandFailed, { commandId: row.id, kind: row.kind })
            return this.failed(COMMAND_FAILED_CODE, {})
        }
    }

    private failed(code: string, params: Record<string, string | number>): Settlement {
        const key = code === COMMAND_FAILED_CODE ? "shifts.commandFailed" : `errors.${code}`
        return { status: "failed", result: null, code, message: this.catalog.get(key, params, "vi") }
    }

    private execute(request: ShiftsCommandRequest, userId: string, workspaceId: string): Promise<object | null> {
        switch (request.kind) {
            case "propose-week":
                return this.schedule.proposeWeek(userId, workspaceId, request.params)
            case "explain-schedule":
                return this.schedule.explainSchedule(userId, workspaceId, request.params)
            case "reassign-shift":
                return this.nothing(this.schedule.reassignShift(userId, workspaceId, request.params))
            case "add-draft-shift":
                return this.nothing(this.schedule.addDraftShift(userId, workspaceId, request.params))
            case "remove-draft-shift":
                return this.nothing(this.schedule.removeDraftShift(userId, workspaceId, request.params))
            case "request-publish":
                return this.schedule.requestPublish(userId, workspaceId, request.params)
            case "request-swap":
                return this.requests.requestSwap(userId, workspaceId, request.params)
            case "request-leave":
                return this.requests.requestLeave(userId, workspaceId, request.params)
            case "apply-import":
                return this.importing.applyImport(userId, workspaceId, request.params)
        }
    }

    private async nothing(done: Promise<void>): Promise<null> {
        await done
        return null
    }
}
