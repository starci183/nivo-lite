import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { WorkspaceInvitesOptions } from "./workspace-invites.options"

/** Token of the options of the workspace-invites capability. */
export const WORKSPACE_INVITES_OPTIONS: unique symbol = Symbol("domain.workspace-invites.options")

/** Injects the options of the workspace-invites capability. Parameter type: WorkspaceInvitesOptions. */
export const InjectWorkspaceInvitesOptions = (): TypedParameterDecorator<WorkspaceInvitesOptions> =>
    injector<WorkspaceInvitesOptions>(WORKSPACE_INVITES_OPTIONS)
