import { QueryHandler } from "@nestjs/cqrs"
import { ToolsConsoleService, type CallLogView } from "@modules/domain/tools"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ToolCallLogQuery } from "./tool-call-log.query"

@QueryHandler(ToolCallLogQuery)
/** Asks for the latest gateway audit lines (secrets masked). The admin service checks the owner or manager role. */
export class ToolCallLogHandler extends ICQRSHandler<ToolCallLogQuery, ReadonlyArray<CallLogView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: ToolsConsoleService,
    ) {
        super(logger)
    }

    protected override process(query: ToolCallLogQuery): Promise<ReadonlyArray<CallLogView>> {
        return this.admin.callLog({
            actor: { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            limit: query.params.request.limit,
        })
    }
}
