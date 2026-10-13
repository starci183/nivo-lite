import { Query } from "@nestjs/cqrs"
import type { DatabaseTable } from "@modules/integrations/data-sources"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { TestDatabaseRequest } from "./test-database.contracts"

/** Connects read only to the owner database and lists its tables. */
export class TestDatabaseQuery extends Query<ReadonlyArray<DatabaseTable>> {
    constructor(readonly params: ExecuteParams<TestDatabaseRequest>) {
        super()
    }
}
