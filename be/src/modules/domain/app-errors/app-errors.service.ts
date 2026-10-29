import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ErrorReportContext, ErrorReporter } from "@modules/platform/errors"
import { InjectLogger, redactValue } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AppErrorsLogEvent } from "./app-errors.log-events"
import { MESSAGE_MAX, SCOPE_MAX, STACK_MAX, clean, messageOf, uuidOrNull } from "./app-errors.policy"

@Injectable()
/**
 * App error capture for the team console (/admin/health): one `app_errors` row per unexpected failure. The workspace is the context's
 * `workspaceId` when the caller knows it, else the workspace of its `connectionId`. Every text and fact is scrubbed of credentials
 * before it is written, and a report never throws, so it is safe in any failure path.
 */
export class AppErrorsService implements ErrorReporter {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Records one failure under `scope`; a failed write is logged and dropped. */
    async report(scope: string, error: unknown, context: ErrorReportContext = {}): Promise<void> {
        const { workspaceId, connectionId, ...facts } = context
        const connection = uuidOrNull(connectionId)
        const stack = error instanceof Error && error.stack !== undefined ? clean(error.stack, STACK_MAX) : null
        const record = connection === null ? facts : { ...facts, connectionId: connection }
        await callDbFunction(this.entityManager, "public.app_errors_record", [
            clean(scope, SCOPE_MAX),
            clean(messageOf(error), MESSAGE_MAX),
            stack,
            uuidOrNull(workspaceId),
            connection,
            JSON.stringify(redactValue(record)),
        ]).catch((cause: unknown) => {
            this.logger.error(AppErrorsLogEvent.ReportFailed, cause, { scope })
        })
    }
}
