import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the n8n host integration. */
export enum N8nHostErrorCode {
    /** A workflow file has no name or no nodes. */
    WorkflowInvalid = "N8N_HOST_WORKFLOW_INVALID",
    /** There is no workflow to import. */
    NoWorkflows = "N8N_HOST_NO_WORKFLOWS",
    /** The n8n host is not configured and the sync is not local. */
    HostMissing = "N8N_HOST_MISSING",
    /** A command on the n8n host ended with a failure. */
    CommandFailed = "N8N_HOST_COMMAND_FAILED",
    /** A workflow is missing after the import. */
    WorkflowMissing = "N8N_HOST_WORKFLOW_MISSING",
}

/** How each n8n host code travels. */
export const N8N_HOST_ERROR_KINDS: Record<N8nHostErrorCode, ErrorKind> = {
    [N8nHostErrorCode.WorkflowInvalid]: "invalid",
    [N8nHostErrorCode.NoWorkflows]: "invalid",
    [N8nHostErrorCode.HostMissing]: "invalid",
    [N8nHostErrorCode.CommandFailed]: "unavailable",
    [N8nHostErrorCode.WorkflowMissing]: "unavailable",
}

/** The one error class of the n8n host integration. */
export class N8nHostError extends DomainError<N8nHostErrorCode> {}
