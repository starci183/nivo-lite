import { createParamDecorator } from "@nestjs/common"
import type { ExecutionContext } from "@nestjs/common"
import { requestOf } from "@modules/platform/http-security"
import { unwrapOutcome } from "@modules/platform/primitives"
import { WorkspaceMembersError } from "./errors/workspace-members.error"
import { WORKSPACE_HEADER, selectWorkspace } from "./workspace-selector.policy"

/**
 * The workspace the request names in `X-Workspace-Id`. It only selects: the handler proves access by asking the
 * members service to `require` the caller's membership in it.
 */
export const WorkspaceId = createParamDecorator((_data: unknown, context: ExecutionContext): string =>
    unwrapOutcome(selectWorkspace(requestOf(context).headers[WORKSPACE_HEADER]), WorkspaceMembersError),
)
