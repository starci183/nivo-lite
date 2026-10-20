import type { ConnectionActor } from "@modules/domain/connections"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** The actor of a console request: the signed-in principal in the workspace it names. */
export const actorOf = <T extends { readonly workspaceId: string }>(params: ExecuteParams<T>): ConnectionActor => ({
    principalId: params.principal.id,
    workspaceId: params.request.workspaceId,
})
