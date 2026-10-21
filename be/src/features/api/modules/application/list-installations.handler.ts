import { QueryHandler } from "@nestjs/cqrs"
import { ModuleInstallService } from "@modules/domain/modules"
import type { InstallationView } from "@modules/domain/modules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListInstallationsQuery } from "./list-installations.query"

@QueryHandler(ListInstallationsQuery)
/** Answers the installed agents from the module install service. */
export class ListInstallationsHandler extends ICQRSHandler<ListInstallationsQuery, ReadonlyArray<InstallationView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly installs: ModuleInstallService,
    ) {
        super(logger)
    }

    protected override process(query: ListInstallationsQuery): Promise<ReadonlyArray<InstallationView>> {
        return this.installs.list(query.params.principal.id, query.params.request.workspaceId)
    }
}
