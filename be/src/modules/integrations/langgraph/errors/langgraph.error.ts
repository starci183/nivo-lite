import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the LangGraph integration: every way a thread call is refused by name instead of doing nothing. */
export enum LanggraphErrorCode {
    /** A tracing switch of LangSmith is set in the environment (`key`); the app does not start, so no customer data leaves it. */
    TracingForbidden = "LANGGRAPH_TRACING_FORBIDDEN",
    /** The graph given to `resume` or `drive` is not the version the thread started on (`pinned`, `given`). */
    VersionMismatch = "LANGGRAPH_VERSION_MISMATCH",
    /** `start` named a thread that already has a checkpoint. */
    ThreadExists = "LANGGRAPH_THREAD_EXISTS",
    /** `resume` named a thread that does not wait for a person. */
    ThreadNotStopped = "LANGGRAPH_THREAD_NOT_STOPPED",
    /** A node answered a `goto` it did not declare (`node`, `goto`). */
    RouteUndeclared = "LANGGRAPH_ROUTE_UNDECLARED",
    /** A node of a fan-out branch wrote a key only the shared state's nodes write, or ended the thread from the branch (`node`, `what`). */
    BranchInvalid = "LANGGRAPH_BRANCH_INVALID",
    /** A value that must be stored in a checkpoint is not plain JSON (`at`). */
    NotPlain = "LANGGRAPH_NOT_PLAIN",
    /** The graph cannot be compiled: no entry, a key used twice or reserved, a route to a node it does not have (`node`). */
    GraphUnsound = "LANGGRAPH_GRAPH_UNSOUND",
    /** The thread's checkpoint cannot be read as a thread of this engine (`thread`). */
    ThreadUnreadable = "LANGGRAPH_THREAD_UNREADABLE",
    /** A key the checkpoint saver stores is not a string of the allowed length (`key`). */
    CheckpointKeyInvalid = "LANGGRAPH_CHECKPOINT_KEY_INVALID",
    /** A checkpoint call named no workspace or no thread (`key`): a row is never written or read outside its scope. */
    CheckpointScopeMissing = "LANGGRAPH_CHECKPOINT_SCOPE_MISSING",
    /** A checkpoint write came from a driver whose lease was taken over; nothing was stored and the drive must stop. */
    CheckpointFenced = "LANGGRAPH_CHECKPOINT_FENCED",
    /** A value to store in a checkpoint is larger than the saver allows (`thread`, `bytes`, `limit`); nothing was stored. */
    CheckpointTooLarge = "LANGGRAPH_CHECKPOINT_TOO_LARGE",
    /** A tool id has no name the provider accepts on the wire (`name`): it is refused before the first model call. */
    ToolNameUnmappable = "LANGGRAPH_TOOL_NAME_UNMAPPABLE",
}

/** How each code travels. */
export const LANGGRAPH_ERROR_KINDS: Record<LanggraphErrorCode, ErrorKind> = {
    [LanggraphErrorCode.TracingForbidden]: "internal",
    [LanggraphErrorCode.VersionMismatch]: "conflict",
    [LanggraphErrorCode.ThreadExists]: "conflict",
    [LanggraphErrorCode.ThreadNotStopped]: "conflict",
    [LanggraphErrorCode.RouteUndeclared]: "internal",
    [LanggraphErrorCode.BranchInvalid]: "internal",
    [LanggraphErrorCode.NotPlain]: "internal",
    [LanggraphErrorCode.GraphUnsound]: "internal",
    [LanggraphErrorCode.ThreadUnreadable]: "internal",
    [LanggraphErrorCode.CheckpointKeyInvalid]: "internal",
    [LanggraphErrorCode.CheckpointScopeMissing]: "internal",
    [LanggraphErrorCode.CheckpointFenced]: "conflict",
    [LanggraphErrorCode.CheckpointTooLarge]: "internal",
    [LanggraphErrorCode.ToolNameUnmappable]: "internal",
}

/** The one error class of the LangGraph integration. */
export class LanggraphError extends DomainError<LanggraphErrorCode> {}
