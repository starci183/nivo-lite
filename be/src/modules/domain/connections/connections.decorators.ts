import { createParamDecorator } from "@nestjs/common"
import type { ExecutionContext } from "@nestjs/common"

/** The header that names the workspace a console request is made in. */
export const WORKSPACE_HEADER = "x-workspace-id"

/**
 * The raw workspace header of a console request. Handlers apply a `ParseUUIDPipe` as the second argument, because the
 * stock header decorator takes no pipes: `@WorkspaceHeader(undefined, new ParseUUIDPipe())`.
 */
export const WorkspaceHeader = createParamDecorator((_data: unknown, context: ExecutionContext): unknown => {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>()
    return request.headers[WORKSPACE_HEADER]
})
