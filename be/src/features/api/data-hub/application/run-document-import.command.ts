import { Command } from "@nestjs/cqrs"
import type { CsvImportResult } from "@modules/domain/data-hub"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RunDocumentImportRequest } from "./run-document-import.contracts"

/** Imports documents (uploaded files and/or a Google Docs link) as document rows. */
export class RunDocumentImportCommand extends Command<CsvImportResult> {
    constructor(readonly params: ExecuteParams<RunDocumentImportRequest>) {
        super()
    }
}
