import { Query } from "@nestjs/cqrs"
import type { CareOptOutView } from "@modules/domain/agent-doors"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReadCareOptOutRequest } from "./agent-doors.contracts"

/** The care opt-out of a customer as it stands, with the last press of the shop's door. */
export class ReadCareOptOutQuery extends Query<CareOptOutView | null> {
    constructor(readonly params: ExecuteParams<ReadCareOptOutRequest>) {
        super()
    }
}
