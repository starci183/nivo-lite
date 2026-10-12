import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { InviteDeliveryPort } from "./workspace-invites.contracts"
import type { WorkspaceInvitesOptions } from "./workspace-invites.options"

/** Token of the options of the workspace-invites capability. */
export const WORKSPACE_INVITES_OPTIONS: unique symbol = Symbol("domain.workspace-invites.options")

/** Injects the options of the workspace-invites capability. Parameter type: WorkspaceInvitesOptions. */
export const InjectWorkspaceInvitesOptions = (): TypedParameterDecorator<WorkspaceInvitesOptions> =>
    injector<WorkspaceInvitesOptions>(WORKSPACE_INVITES_OPTIONS)

/** Token of the invitation delivery the composition root hands to the capability. */
export const INVITE_DELIVERY: unique symbol = Symbol("domain.workspace-invites.delivery")

/** Injects the invitation delivery. Parameter type: InviteDeliveryPort. */
export const InjectInviteDelivery = (): TypedParameterDecorator<InviteDeliveryPort> =>
    injector<InviteDeliveryPort>(INVITE_DELIVERY)
