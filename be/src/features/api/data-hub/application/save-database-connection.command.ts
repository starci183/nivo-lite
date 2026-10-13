import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveDatabaseConnectionRequest } from "./save-database-connection.contracts"

/** Creates or updates a database connection; answers its id. */
export class SaveDatabaseConnectionCommand extends Command<string> {
    constructor(readonly params: ExecuteParams<SaveDatabaseConnectionRequest>) {
        super()
    }
}
