import type { ConnectionStatus, FirstEvent } from "@modules/domain/connections"
import type { AppObject, MetaPageChoice, PageSubscription } from "@modules/integrations/meta"

/** The sealed credential of a Meta connection: while the owner is choosing, the Pages they manage; after, the chosen Page only. */
export interface MetaSecret {
    /** The Pages the person manages, each with its own Page token. */
    readonly pages?: ReadonlyArray<MetaPageChoice>
    /** The chosen Page. */
    readonly pageId?: string
    /** The chosen Page token. */
    readonly pageToken?: string
}

/** A Page waiting for the choice (no token). */
export interface MetaPageOption {
    /** The Page id. */
    readonly id: string
    /** The Page name. */
    readonly name: string
    /** The Page category. */
    readonly category: string
    /** The linked Instagram account id. */
    readonly igId: string
    /** The linked Instagram username. */
    readonly igUsername: string
}

/** The wizard view of a Meta connection. */
export interface MetaWizardConnection {
    /** The id of the connection. */
    readonly id: string
    /** The name. */
    readonly name: string
    /** The status. */
    readonly status: ConnectionStatus
    /** Meta app keys are set on this NIVO (otherwise the login cannot start). */
    readonly configured: boolean
    /** The Pages the person manages, waiting for the choice. */
    readonly pages: ReadonlyArray<MetaPageOption>
    /** The chosen Page. */
    readonly pageId: string
    /** The chosen Page name. */
    readonly pageName: string
    /** The linked Instagram account id. */
    readonly igId: string
    /** The linked Instagram username. */
    readonly igUsername: string
    /** The first event the connection accepted. */
    readonly firstEvent: FirstEvent | null
    /** The agents that use the connection. */
    readonly agentIds: ReadonlyArray<string>
}

/** What starting the login answers. */
export interface MetaAuthorization {
    /** The connection the login belongs to. */
    readonly connectionId: string
    /** The Meta login url. */
    readonly url: string
}

/** What asking Meta about a connection answers. */
export interface MetaCheck {
    /** Everything Meta needs to deliver is in place. */
    readonly ok: boolean
    /** The Page token is accepted. */
    readonly tokenOk: boolean
    /** The Page id. */
    readonly pageId: string
    /** The Page name. */
    readonly pageName: string
    /** The Instagram username. */
    readonly igUsername: string
    /** The Page subscription. */
    readonly page: PageSubscription
    /** The app-level webhook for the page object (null when Meta would not tell). */
    readonly appPage: AppObject | null
    /** The app-level webhook for the instagram object. */
    readonly appInstagram: AppObject | null
    /** Whether Meta told the app-level subscription at all. */
    readonly appKnown: boolean
    /** The Page fields wanted. */
    readonly wantPage: ReadonlyArray<string>
    /** The Instagram fields wanted. */
    readonly wantInstagram: ReadonlyArray<string>
    /** The webhook address to register on the Meta app. */
    readonly webhookUrl: string
    /** The OAuth redirect to register on the Meta app. */
    readonly redirectUri: string
    /** The site is not public https: Meta cannot reach the webhook from here. */
    readonly localOnly: boolean
    /** The webhook verify token is set on this deployment. */
    readonly verifyTokenSet: boolean
    /** The subscriptions were made again before the check. */
    readonly repaired: boolean
}

/** What the OAuth callback carries. */
export interface MetaCallbackInput {
    /** The signed state Meta echoed. */
    readonly state: string | undefined
    /** The login code. */
    readonly code: string | undefined
    /** The error Meta reported instead of a code. */
    readonly error: string | undefined
}

/** Where the browser goes back to once the login is decided. */
export interface MetaCallbackResult {
    /** The absolute location to redirect to. */
    readonly location: string
}

/** The pending connection a login resumes; undefined starts a new one. */
export type ResumedConnectionId = string | undefined

/** What a Meta webhook verification request carries, read from its `hub.*` query parameters. */
export interface MetaChallengeQuery {
    /** `hub.mode`; only `subscribe` is answered. */
    readonly mode: string | undefined
    /** `hub.verify_token`; must equal the configured verify token. */
    readonly verifyToken: string | undefined
    /** `hub.challenge`, echoed back when the request is ours. */
    readonly challenge: string | undefined
}
