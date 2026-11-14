import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { EnterpriseSeedPlace } from "./enterprise-seed.contracts"

/** The enterprise workspace a roster is installed into, as the enterprise seed just ensured it. */
export interface EnterpriseRosterSeat {
    /** The enterprise workspace (the one holding the identifier). */
    readonly workspaceId: string
    /** Its owner, who the installation writes as. */
    readonly ownerId: string
    /** The enterprise identifier (`nivo-web`): the plugins whose `enterprises` name it bring the roster. */
    readonly identifier: string
    /** Where the seed runs: `local` (dev) may attach sandbox accounts where no live one exists; `prod` never does. */
    readonly place: EnterpriseSeedPlace
}

/**
 * THE ROSTER STEP of the enterprise seed (ruling R17): installs, into the enterprise workspace, the agents its private plugins declare
 * (their template agents: each agent, its primary workflow, the provider kinds it works with, the channels it is the front door of).
 * Implemented by the workspace seed (`RosterSeedService`), bound by the app root; an app that binds none seeds the foundation only.
 * Answers whether anything changed; a second run changes nothing.
 */
export interface EnterpriseRoster {
    /** Installs the roster of the enterprise into its workspace; true when anything was written. */
    install(seat: EnterpriseRosterSeat): Promise<boolean>
}

/** Token of the roster step. */
export const ENTERPRISE_ROSTER: unique symbol = Symbol("domain.channel-provisioning.enterprise-roster")

/** Injects the roster step. Parameter type: EnterpriseRoster. */
export const InjectEnterpriseRoster = (): TypedParameterDecorator<EnterpriseRoster> => injector<EnterpriseRoster>(ENTERPRISE_ROSTER)
