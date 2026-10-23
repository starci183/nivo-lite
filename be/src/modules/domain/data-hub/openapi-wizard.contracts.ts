import type { OpenApiConfig, OpenApiSpec } from "@modules/integrations/data-sources"

/** The credential as typed in the wizard; the type is cleaned by the domain. */
export interface OpenApiAuthDraft {
    /** The authentication type: none, header, query, bearer or basic. */
    readonly type: string
    /** Header or query parameter name. */
    readonly name: string
    /** The key or token (blank keeps the stored one). */
    readonly value: string
    /** The basic-auth user (blank keeps the stored one). */
    readonly user: string
    /** The basic-auth password (blank keeps the stored one). */
    readonly password: string
}

/** What loadSpec takes. */
export interface OpenApiSpecSource {
    /** A link to the spec. */
    readonly specUrl: string
    /** The pasted spec text (wins over the link when not blank). */
    readonly specText: string
}

/** A spec read from a link or text, with the link it came from. */
export interface OpenApiSpecLoaded extends OpenApiSpec {
    /** The link the spec was read from (may be empty). */
    readonly specUrl: string
}

/** What testing one operation takes. */
export interface OpenApiOperationTest {
    /** The connection being edited, so blank secrets fall back to the stored ones. */
    readonly connectionId?: string | null | undefined
    /** The API's base URL. */
    readonly baseUrl: string
    /** The credential typed (blank secrets fall back to the stored ones). */
    readonly auth: OpenApiAuthDraft
    /** The operation, an untrusted JSON value cleaned by the domain. */
    readonly op: unknown
    /** The fixed query string. */
    readonly fixedQuery: string
    /** The dotted path of the items array the owner typed. */
    readonly itemsPath: string
}

/** What testing one operation found. */
export interface OpenApiOperationTestResult {
    /** The HTTP status. */
    readonly status: number
    /** How many items the answer holds. */
    readonly itemCount: number
    /** The path of the items array found. */
    readonly itemsPath: string
    /** Suggested id field. */
    readonly idField: string
    /** Suggested title field. */
    readonly titleField: string
    /** The first keys of the first item. */
    readonly sampleKeys: ReadonlyArray<string>
    /** The reason in plain Vietnamese when the call did not give usable data. */
    readonly error: string | null
}

/** What the wizard needs to continue editing a connection; never any secret. */
export interface OpenApiConnectionView {
    /** The connection name. */
    readonly name: string
    /** The saved configuration. */
    readonly config: OpenApiConfig
    /** Minutes between syncs; null is manual only. */
    readonly syncEveryMinutes: number | null
    /** Whether a key, token or password is stored. */
    readonly hasSecret: boolean
    /** The stored basic-auth user. */
    readonly authUser: string
}

/** What saving an API connection takes. */
export interface OpenApiConnectionDraft {
    /** The connection being edited; absent or null creates one. */
    readonly connectionId?: string | null | undefined
    /** The name. */
    readonly name: string
    /** The configuration, an untrusted JSON value cleaned by the domain. */
    readonly config: unknown
    /** The credential typed (blank secrets fall back to the stored ones). */
    readonly auth: OpenApiAuthDraft
    /** Minutes between syncs: null, 15, 60, 360 or 1440. */
    readonly syncEveryMinutes?: number | null | undefined
}
