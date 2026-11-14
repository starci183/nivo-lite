import { Query } from "@nestjs/cqrs"
import type { ConnectionFieldsView } from "@modules/domain/connection-fields"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetConnectionFieldsRequest } from "./get-connection-fields.contracts"

/** Asks for the connection form of an account. */
export class GetConnectionFieldsQuery extends Query<ConnectionFieldsView> {
    constructor(readonly params: ExecuteParams<GetConnectionFieldsRequest>) {
        super()
    }
}
