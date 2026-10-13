import type { PreviewImportOutput } from "@modules/domain/shifts"
import type { PreviewShiftsImportRequest } from "../../application/preview-shifts-import.contracts"
import type { PreviewShiftsImportInput } from "./dto/preview-shifts-import.input"
import type { PreviewShiftsImportType } from "./dto/preview-shifts-import.type"

/** Maps the GraphQL input to the preview request of the workspace it names. */
export const toPreviewShiftsImportRequest = (
    workspaceId: string,
    input: PreviewShiftsImportInput,
): PreviewShiftsImportRequest => ({
    workspaceId,
    ...input,
})

/** Maps the parsed import to the GraphQL type. */
export const toPreviewShiftsImportType = (result: PreviewImportOutput): PreviewShiftsImportType => ({
    positions: [...result.positions],
    staff: result.staff.map((person) => ({ ...person, positions: [...person.positions] })),
    blocks: result.blocks.map((block) => ({ ...block })),
    errors: [...result.errors],
})
