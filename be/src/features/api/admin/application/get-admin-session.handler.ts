import { QueryHandler } from "@nestjs/cqrs"
import { AdminDirectoryService } from "@modules/domain/platform-admin"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GetAdminSessionResult } from "./get-admin-session.contracts"
import { GetAdminSessionQuery } from "./get-admin-session.query"

@QueryHandler(GetAdminSessionQuery)
/** Answers who the signed-in platform admin is; anyone else gets a not-found. */
export class GetAdminSessionHandler extends ICQRSHandler<GetAdminSessionQuery, GetAdminSessionResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly adminDirectoryService: AdminDirectoryService,
    ) {
        super(logger)
    }

    protected override process(command: GetAdminSessionQuery): Promise<GetAdminSessionResult> {
        return this.adminDirectoryService.session(command.params.principal)
    }
}
