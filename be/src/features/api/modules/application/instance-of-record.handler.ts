import { QueryHandler } from "@nestjs/cqrs"
import type { RecordInstallation } from "@modules/domain/module-installations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InstanceOfRecordQuery } from "./instance-of-record.query"
import { InstanceOfRecordService } from "./instance-of-record.service"

@QueryHandler(InstanceOfRecordQuery)
/** Answers the owning installation from the record owner lookup of the feature. */
export class InstanceOfRecordHandler extends ICQRSHandler<InstanceOfRecordQuery, RecordInstallation> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly records: InstanceOfRecordService,
    ) {
        super(logger)
    }

    protected override process(query: InstanceOfRecordQuery): Promise<RecordInstallation> {
        return this.records.installationOfRecord(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.recordId,
        )
    }
}
