import { Query } from "@nestjs/cqrs"
import type { RecordInstallation } from "@modules/domain/module-installations"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { InstanceOfRecordRequest } from "./instance-of-record.contracts"

/** Asks which installation owns a record. */
export class InstanceOfRecordQuery extends Query<RecordInstallation> {
    constructor(readonly params: ExecuteParams<InstanceOfRecordRequest>) {
        super()
    }
}
