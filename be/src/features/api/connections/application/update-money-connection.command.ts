import { Command } from "@nestjs/cqrs"
import type { WizardConnection } from "@modules/domain/channel-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { UpdateMoneyConnectionRequest } from "./update-money-connection.contracts"

/** Edits a bank or payment feed. */
export class UpdateMoneyConnectionCommand extends Command<WizardConnection> {
    constructor(readonly params: ExecuteParams<UpdateMoneyConnectionRequest>) {
        super()
    }
}
