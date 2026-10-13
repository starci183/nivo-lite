import type { CsvPreview } from "@modules/domain/data-hub"
import type { PreviewCsvSourceRequest } from "../../application/preview-csv-source.contracts"
import type { CsvPreviewType } from "./dto/csv-preview.type"
import type { PreviewCsvSourceInput } from "./dto/preview-csv-source.input"

/** Maps the GraphQL arguments of previewCsvSource to the request. */
export const toPreviewCsvSourceRequest = (
    workspaceId: string,
    input: PreviewCsvSourceInput,
): PreviewCsvSourceRequest => ({
    workspaceId,
    ...input,
})

/** Maps the answer of previewCsvSource to the GraphQL type. */
export const toPreviewCsvSourceType = (result: CsvPreview): CsvPreviewType => result
