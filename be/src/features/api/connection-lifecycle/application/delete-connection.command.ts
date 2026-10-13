import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DeleteConnectionRequest, DeleteConnectionResult } from "./delete-connection.contracts"

/** Removes a disconnected connection. */
export class DeleteConnectionCommand extends Command<DeleteConnectionResult> {
    constructor(readonly params: ExecuteParams<DeleteConnectionRequest>) {
        super()
    }
}
