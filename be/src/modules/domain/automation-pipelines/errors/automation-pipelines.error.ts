import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the automation pipelines capability. */
export enum AutomationPipelinesErrorCode {
    /** The write of a pipeline answered no row. */
    NotSaved = "AUTOMATION_PIPELINES_NOT_SAVED",
}

/** How each automation pipelines code travels. */
export const AUTOMATION_PIPELINES_ERROR_KINDS: Record<AutomationPipelinesErrorCode, ErrorKind> = {
    [AutomationPipelinesErrorCode.NotSaved]: "internal",
}

/** The one error class of the automation pipelines capability. */
export class AutomationPipelinesError extends DomainError<AutomationPipelinesErrorCode> {}
