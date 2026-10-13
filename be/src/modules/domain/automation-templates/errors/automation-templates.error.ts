import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the automation templates. */
export enum AutomationTemplatesErrorCode {
    /** A definition does not have the shape of a template; the params name the key and the field. */
    DefinitionInvalid = "AUTOMATION_TEMPLATES_DEFINITION_INVALID",
    /** No template has the requested key. */
    TemplateUnknown = "AUTOMATION_TEMPLATES_TEMPLATE_UNKNOWN",
}

/** How each automation templates code travels. */
export const AUTOMATION_TEMPLATES_ERROR_KINDS: Record<AutomationTemplatesErrorCode, ErrorKind> = {
    [AutomationTemplatesErrorCode.DefinitionInvalid]: "invalid",
    [AutomationTemplatesErrorCode.TemplateUnknown]: "not-found",
}

/** The one error class of the automation templates. */
export class AutomationTemplatesError extends DomainError<AutomationTemplatesErrorCode> {}
