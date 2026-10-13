import { Query } from "@nestjs/cqrs"
import type { ZaloWizardConnection } from "@modules/domain/channel-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetZaloConnectionRequest } from "./get-zalo-connection.contracts"

/** Asks for the wizard view of a Zalo OA connection. */
export class GetZaloConnectionQuery extends Query<ZaloWizardConnection> {
    constructor(readonly params: ExecuteParams<GetZaloConnectionRequest>) {
        super()
    }
}
