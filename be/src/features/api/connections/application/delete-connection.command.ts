import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DeleteConnectionRequest } from "./delete-connection.contracts"

/** Removes a disconnected connection from the list. */
export class DeleteConnectionCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<DeleteConnectionRequest>) {
        super()
    }
}
