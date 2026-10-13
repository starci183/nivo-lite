import { Query } from "@nestjs/cqrs"
import type { WizardConnection } from "@modules/domain/channel-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetMoneyConnectionRequest } from "./get-money-connection.contracts"

/** Asks for the wizard view of a bank or payment feed. */
export class GetMoneyConnectionQuery extends Query<WizardConnection> {
    constructor(readonly params: ExecuteParams<GetMoneyConnectionRequest>) {
        super()
    }
}
