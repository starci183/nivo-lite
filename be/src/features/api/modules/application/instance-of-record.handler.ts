import { QueryHandler } from "@nestjs/cqrs"
import type { RecordInstallation } from "@modules/domain/module-installations"
import { ModuleInstallService } from "@modules/domain/modules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InstanceOfRecordQuery } from "./instance-of-record.query"

@QueryHandler(InstanceOfRecordQuery)
/** Answers the owning installation from the install service. */
export class InstanceOfRecordHandler extends ICQRSHandler<InstanceOfRecordQuery, RecordInstallation> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly installs: ModuleInstallService,
    ) {
        super(logger)
    }

    protected override process(query: InstanceOfRecordQuery): Promise<RecordInstallation> {
        return this.installs.installationOfRecord(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.recordId,
        )
    }
}
