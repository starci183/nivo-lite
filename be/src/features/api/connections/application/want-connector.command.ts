import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { WantConnectorRequest, WantConnectorResult } from "./want-connector.contracts"

/** Records that the workspace wants a planned connector (manager). */
export class WantConnectorCommand extends Command<WantConnectorResult> {
    constructor(readonly params: ExecuteParams<WantConnectorRequest>) {
        super()
    }
}
