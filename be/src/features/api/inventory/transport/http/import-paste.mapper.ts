import type { ImportPasteRequest } from "../../application/import-paste.contracts"
import type { ImportPasteOutput } from "@modules/domain/inventory"
import type { ImportPasteRequest as ImportPasteHttpRequest } from "./dto/import-paste.request"
import type { ImportPasteResponse } from "./dto/import-paste.response"

/** Maps the HTTP request to the import-paste request. */
export const toImportPasteRequest = (input: ImportPasteHttpRequest, workspaceId: string): ImportPasteRequest => ({
    workspaceId,
    input: {
        raw: input.raw,
    },
})

/** Maps the import-paste result to the HTTP response. */
export const toImportPasteResponse = (result: ImportPasteOutput): ImportPasteResponse => ({
    created: result.created,
    updated: result.updated,
    stocked: result.stocked,
    skipped: [...result.skipped],
})
