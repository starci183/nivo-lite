import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { OutboundRoute } from "./website-lead-wake.policy"

/** What the website intake asks the channels: the routes by which a phone number can be contacted before any chat exists. */
export interface WebsiteContactRoutes {
    /** The routes the workspace has a connection for; empty when none can carry a first message to a phone. */
    routesOf(workspaceId: string): Promise<ReadonlyArray<OutboundRoute>>
}

/** Token of the routes port, bound by the capability that owns the ZNS and SMS connections; with none bound the first contact is the owner's item. */
export const WEBSITE_CONTACT_ROUTES: unique symbol = Symbol("domain.inbox-leads.website-contact-routes")

/** Injects the routes port. Parameter type: WebsiteContactRoutes. */
export const InjectWebsiteContactRoutes = (): TypedParameterDecorator<WebsiteContactRoutes> =>
    injector<WebsiteContactRoutes>(WEBSITE_CONTACT_ROUTES)
