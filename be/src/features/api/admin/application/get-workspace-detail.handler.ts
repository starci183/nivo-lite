import { QueryHandler } from "@nestjs/cqrs"
import { AdminDirectoryService } from "@modules/domain/platform-admin"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GetWorkspaceDetailResult } from "./get-workspace-detail.contracts"
import { GetWorkspaceDetailQuery } from "./get-workspace-detail.query"

@QueryHandler(GetWorkspaceDetailQuery)
/** Answers the read-only overview of one workspace. */
export class GetWorkspaceDetailHandler extends ICQRSHandler<GetWorkspaceDetailQuery, GetWorkspaceDetailResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly adminDirectoryService: AdminDirectoryService,
    ) {
        super(logger)
    }

    protected override process(command: GetWorkspaceDetailQuery): Promise<GetWorkspaceDetailResult> {
        return this.adminDirectoryService.workspaceDetail(command.params.principal, command.params.request.workspaceId)
    }
}
