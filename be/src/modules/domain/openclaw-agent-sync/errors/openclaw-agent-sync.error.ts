import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the openclaw-agent-sync capability. */
export enum OpenclawAgentSyncErrorCode {
    /** The agent workspaces cannot be written: no config directory is set. */
    WorkspaceUnavailable = "OPENCLAW_AGENT_SYNC_WORKSPACE_UNAVAILABLE",
}

/** How each openclaw-agent-sync code travels. */
export const OPENCLAW_AGENT_SYNC_ERROR_KINDS: Record<OpenclawAgentSyncErrorCode, ErrorKind> = {
    [OpenclawAgentSyncErrorCode.WorkspaceUnavailable]: "unavailable",
}

/** The one error class of the openclaw-agent-sync capability. */
export class OpenclawAgentSyncError extends DomainError<OpenclawAgentSyncErrorCode> {}
