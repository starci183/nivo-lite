import { QueryHandler } from "@nestjs/cqrs"
import { DriveGrantService } from "@modules/domain/google-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { DriveGrantResult } from "./get-drive-grant.contracts"
import { GetDriveGrantQuery } from "./get-drive-grant.query"

@QueryHandler(GetDriveGrantQuery)
/** Reads the Google Drive read grant through the DriveGrantService. */
export class GetDriveGrantHandler extends ICQRSHandler<GetDriveGrantQuery, DriveGrantResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly drive: DriveGrantService,
    ) {
        super(logger)
    }

    protected override process(query: GetDriveGrantQuery): Promise<DriveGrantResult> {
        return this.drive.grant({
            principalId: query.params.principal.id,
            workspaceId: query.params.request.workspaceId,
        })
    }
}
