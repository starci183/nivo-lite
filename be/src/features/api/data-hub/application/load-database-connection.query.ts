import { Query } from "@nestjs/cqrs"
import type { SavedDatabase } from "@modules/domain/data-hub"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { LoadDatabaseConnectionRequest } from "./load-database-connection.contracts"

/** Reopens a saved database connection for editing. */
export class LoadDatabaseConnectionQuery extends Query<SavedDatabase> {
    constructor(readonly params: ExecuteParams<LoadDatabaseConnectionRequest>) {
        super()
    }
}
