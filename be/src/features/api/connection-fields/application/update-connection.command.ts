import { Command } from "@nestjs/cqrs"
import type { ConnectionFieldsView } from "@modules/domain/connection-fields"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { UpdateConnectionRequest } from "./update-connection.contracts"

/** Changes an account through the writer of its provider. */
export class UpdateConnectionCommand extends Command<ConnectionFieldsView> {
    constructor(readonly params: ExecuteParams<UpdateConnectionRequest>) {
        super()
    }
}
