import { QueryHandler } from "@nestjs/cqrs"
import { AdminDirectoryService } from "@modules/domain/platform-admin"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ListWorkspacesResult } from "./list-workspaces.contracts"
import { ListWorkspacesQuery } from "./list-workspaces.query"

@QueryHandler(ListWorkspacesQuery)
/** Lists every customer workspace with billing, agents, connections and activity, filtered and searched. */
export class ListWorkspacesHandler extends ICQRSHandler<ListWorkspacesQuery, ListWorkspacesResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly adminDirectoryService: AdminDirectoryService,
    ) {
        super(logger)
    }

    protected override process(command: ListWorkspacesQuery): Promise<ListWorkspacesResult> {
        return this.adminDirectoryService.listWorkspaces(command.params.principal, command.params.request)
    }
}
