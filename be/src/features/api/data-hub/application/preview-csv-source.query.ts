import { Query } from "@nestjs/cqrs"
import type { CsvPreview } from "@modules/domain/data-hub"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PreviewCsvSourceRequest } from "./preview-csv-source.contracts"

/** Reads an import source and answers its headers, first rows and a suggested mapping. */
export class PreviewCsvSourceQuery extends Query<CsvPreview> {
    constructor(readonly params: ExecuteParams<PreviewCsvSourceRequest>) {
        super()
    }
}
