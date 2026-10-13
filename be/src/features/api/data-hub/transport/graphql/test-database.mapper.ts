import type { DatabaseTable } from "@modules/integrations/data-sources"
import type { TestDatabaseRequest } from "../../application/test-database.contracts"
import type { DatabaseTableType } from "./dto/database-table.type"
import type { TestDatabaseInput } from "./dto/test-database.input"

/** Maps the GraphQL arguments of testDatabase to the request. */
export const toTestDatabaseRequest = (workspaceId: string, input: TestDatabaseInput): TestDatabaseRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    target: input.target,
})

/** Maps the tables testDatabase found to the GraphQL types. */
export const toDatabaseTableTypes = (result: ReadonlyArray<DatabaseTable>): Array<DatabaseTableType> =>
    result.map((table) => ({
        schema: table.schema,
        name: table.name,
        columns: table.columns.map((column) => ({ name: column.name, type: column.type })),
    }))
