import { Command } from "@nestjs/cqrs"
import type { WizardConnection } from "@modules/domain/channel-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { StartMoneyConnectionRequest } from "./start-money-connection.contracts"

/** Starts a bank or payment feed as pending. */
export class StartMoneyConnectionCommand extends Command<WizardConnection> {
    constructor(readonly params: ExecuteParams<StartMoneyConnectionRequest>) {
        super()
    }
}
