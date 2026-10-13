import { QueryHandler } from "@nestjs/cqrs"
import { AdminDirectoryService } from "@modules/domain/platform-admin"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GetPlatformHealthResult } from "./get-platform-health.contracts"
import { GetPlatformHealthQuery } from "./get-platform-health.query"

@QueryHandler(GetPlatformHealthQuery)
/** Answers the platform health page: engine, queue, failures, sign-ups, billing events and errors. */
export class GetPlatformHealthHandler extends ICQRSHandler<GetPlatformHealthQuery, GetPlatformHealthResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly adminDirectoryService: AdminDirectoryService,
    ) {
        super(logger)
    }

    protected override process(command: GetPlatformHealthQuery): Promise<GetPlatformHealthResult> {
        return this.adminDirectoryService.health(command.params.principal)
    }
}
