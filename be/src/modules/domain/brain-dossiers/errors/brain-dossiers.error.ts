import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the brain-dossiers capability. */
export enum BrainDossiersErrorCode {
    /** The checklist tab has no header row naming the reference, category, dossier and status columns. */
    ColumnsMissing = "BRAIN_DOSSIERS_COLUMNS_MISSING",
    /** The checklist tab holds no dossier row that can be read. */
    ChecklistEmpty = "BRAIN_DOSSIERS_EMPTY",
    /** The checklist tab holds more dossiers than one workspace may track. */
    TooMany = "BRAIN_DOSSIERS_TOO_MANY",
}

/** How each brain-dossiers code travels. */
export const BRAIN_DOSSIERS_ERROR_KINDS: Record<BrainDossiersErrorCode, ErrorKind> = {
    [BrainDossiersErrorCode.ColumnsMissing]: "invalid",
    [BrainDossiersErrorCode.ChecklistEmpty]: "invalid",
    [BrainDossiersErrorCode.TooMany]: "invalid",
}

/** The one error class of the brain-dossiers capability. */
export class BrainDossiersError extends DomainError<BrainDossiersErrorCode> {}
