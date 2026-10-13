import { Query } from "@nestjs/cqrs"
import type { CsvSavedImport } from "@modules/domain/data-hub"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { LoadCsvImportRequest } from "./load-csv-import.contracts"

/** Reads the saved setup of one import. */
export class LoadCsvImportQuery extends Query<CsvSavedImport> {
    constructor(readonly params: ExecuteParams<LoadCsvImportRequest>) {
        super()
    }
}
