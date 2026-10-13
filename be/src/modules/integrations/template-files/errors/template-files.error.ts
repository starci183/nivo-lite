import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the template files integration. */
export enum TemplateFilesErrorCode {
    /** A definition or workflow file is not valid JSON; the params name the file. */
    FileInvalid = "TEMPLATE_FILES_FILE_INVALID",
}

/** How each template files code travels. */
export const TEMPLATE_FILES_ERROR_KINDS: Record<TemplateFilesErrorCode, ErrorKind> = {
    [TemplateFilesErrorCode.FileInvalid]: "invalid",
}

/** The one error class of the template files integration. */
export class TemplateFilesError extends DomainError<TemplateFilesErrorCode> {}
