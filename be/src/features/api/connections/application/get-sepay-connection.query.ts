import { Query } from "@nestjs/cqrs"
import type { SepayConnectionView } from "@modules/domain/channel-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetSepayConnectionRequest } from "./get-sepay-connection.contracts"

/** Asks for the page read model of one SePay connection. */
export class GetSepayConnectionQuery extends Query<SepayConnectionView> {
    constructor(readonly params: ExecuteParams<GetSepayConnectionRequest>) {
        super()
    }
}
