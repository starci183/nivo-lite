import { Command } from "@nestjs/cqrs"
import type { CsvImportResult } from "@modules/domain/data-hub"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RunCsvImportRequest } from "./run-csv-import.contracts"

/** Imports a table source (file, Google Sheets link, pasted or typed rows) into a new or an existing import. */
export class RunCsvImportCommand extends Command<CsvImportResult> {
    constructor(readonly params: ExecuteParams<RunCsvImportRequest>) {
        super()
    }
}
