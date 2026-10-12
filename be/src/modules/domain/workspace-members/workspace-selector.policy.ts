import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { WorkspaceMembersErrorCode } from "./errors/workspace-members.error"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The request header that selects the workspace; it is a selector, never proof of access. */
export const WORKSPACE_HEADER = "x-workspace-id"

/** Reads the workspace a request names: one well-formed id in the header, or a refusal. */
export const selectWorkspace = (
    header: string | ReadonlyArray<string> | undefined,
): Outcome<string, WorkspaceMembersErrorCode> =>
    typeof header === "string" && UUID_PATTERN.test(header)
        ? ok(header)
        : refused(WorkspaceMembersErrorCode.WorkspaceRequired)
