import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the n8n runs capability. */
export enum N8nRunsErrorCode {
    /** The template key cannot be a workflow name. */
    TemplateKeyInvalid = "N8N_RUNS_TEMPLATE_KEY_INVALID",
    /** The platform has no public base url configured for the workflows to call back. */
    ApiBaseMissing = "N8N_RUNS_API_BASE_MISSING",
    /** The run token is missing, wrong, expired or the run is finished. */
    RunUnauthorized = "N8N_RUNS_RUN_UNAUTHORIZED",
    /** The email has no recipient, subject template or body template. */
    EmailIncomplete = "N8N_RUNS_EMAIL_INCOMPLETE",
    /** The recipient is not an owner of the workspace. */
    RecipientBlocked = "N8N_RUNS_RECIPIENT_BLOCKED",
    /** The run belongs to a workflow this door does not serve. */
    WorkflowMismatch = "N8N_RUNS_WORKFLOW_MISMATCH",
    /** The run could not be closed. */
    NotClosed = "N8N_RUNS_NOT_CLOSED",
}

/** How each n8n runs code travels. */
export const N8N_RUNS_ERROR_KINDS: Record<N8nRunsErrorCode, ErrorKind> = {
    [N8nRunsErrorCode.TemplateKeyInvalid]: "invalid",
    [N8nRunsErrorCode.ApiBaseMissing]: "internal",
    [N8nRunsErrorCode.RunUnauthorized]: "unauthenticated",
    [N8nRunsErrorCode.EmailIncomplete]: "invalid",
    [N8nRunsErrorCode.RecipientBlocked]: "forbidden",
    [N8nRunsErrorCode.WorkflowMismatch]: "unauthenticated",
    [N8nRunsErrorCode.NotClosed]: "internal",
}

/** The one error class of the n8n runs capability. */
export class N8nRunsError extends DomainError<N8nRunsErrorCode> {}
