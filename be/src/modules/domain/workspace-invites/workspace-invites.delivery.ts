import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { InviteDeliveryPort } from "./workspace-invites.contracts"

/** Token of the invitation delivery the composition root hands to the capability. */
export const INVITE_DELIVERY: unique symbol = Symbol("domain.workspace-invites.delivery")

/** Injects the invitation delivery. Parameter type: InviteDeliveryPort. */
export const InjectInviteDelivery = (): TypedParameterDecorator<InviteDeliveryPort> =>
    injector<InviteDeliveryPort>(INVITE_DELIVERY)
