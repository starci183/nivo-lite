import type { DatabasePreview } from "@modules/integrations/data-sources"
import type { PreviewDatabaseTableRequest } from "../../application/preview-database-table.contracts"
import type { DatabasePreviewType } from "./dto/database-preview.type"
import type { PreviewDatabaseTableInput } from "./dto/preview-database-table.input"

/** Maps the GraphQL arguments of previewDatabaseTable to the request. */
export const toPreviewDatabaseTableRequest = (
    workspaceId: string,
    input: PreviewDatabaseTableInput,
): PreviewDatabaseTableRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    target: input.target,
    mapping: input.mapping,
})

/** Maps the preview to the GraphQL type. */
export const toDatabasePreviewType = (result: DatabasePreview): DatabasePreviewType => ({
    columns: [...result.columns],
    rows: result.rows.map((cells) => ({ cells: [...cells] })),
})
