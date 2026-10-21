import { QueryHandler } from "@nestjs/cqrs"
import { ModuleInstallService } from "@modules/domain/modules"
import type { InstallationView } from "@modules/domain/modules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetInstallationQuery } from "./get-installation.query"

@QueryHandler(GetInstallationQuery)
/** Answers one installed agent from the module install service. */
export class GetInstallationHandler extends ICQRSHandler<GetInstallationQuery, InstallationView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly installs: ModuleInstallService,
    ) {
        super(logger)
    }

    protected override process(query: GetInstallationQuery): Promise<InstallationView> {
        return this.installs.get(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.installationId,
        )
    }
}
