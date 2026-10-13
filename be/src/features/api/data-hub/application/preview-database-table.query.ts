import { Query } from "@nestjs/cqrs"
import type { DatabasePreview } from "@modules/integrations/data-sources"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PreviewDatabaseTableRequest } from "./preview-database-table.contracts"

/** Reads the first rows of one mapped table of the owner database. */
export class PreviewDatabaseTableQuery extends Query<DatabasePreview> {
    constructor(readonly params: ExecuteParams<PreviewDatabaseTableRequest>) {
        super()
    }
}
