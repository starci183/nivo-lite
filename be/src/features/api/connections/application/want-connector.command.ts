import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { WantConnectorRequest } from "./want-connector.contracts"

/** Records that the workspace wants a planned connector. */
export class WantConnectorCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<WantConnectorRequest>) {
        super()
    }
}
