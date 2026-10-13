/** An HTTP method of an API operation. */
export type OpenApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

/** How the owner's API is authenticated. */
export type OpenApiAuthType = "none" | "header" | "query" | "bearer" | "basic"

/** What a pulled operation's rows are about in the hub. */
export type OpenApiPullEntity = "customer" | "order" | "product" | "transaction" | "other"

/** The entities a pull may fill. */
export const OPENAPI_PULL_ENTITIES: ReadonlyArray<OpenApiPullEntity> = [
    "customer",
    "order",
    "product",
    "transaction",
    "other",
]

/** The methods an operation may have. */
export const OPENAPI_METHODS: ReadonlyArray<OpenApiMethod> = ["GET", "POST", "PUT", "PATCH", "DELETE"]

/** The authentication types. */
export const OPENAPI_AUTH_TYPES: ReadonlyArray<OpenApiAuthType> = ["none", "header", "query", "bearer", "basic"]

/** One parameter of an operation. */
export interface OpenApiParam {
    /** The parameter name. */
    readonly name: string
    /** Where it goes. */
    readonly in: "path" | "query" | "header"
    /** Whether the call needs it. */
    readonly required: boolean
}

/** Field suggestions read from the spec's response schema. */
export interface OpenApiSuggest {
    /** Dotted path of the items array in the answer. */
    readonly itemsPath: string
    /** The field that identifies an item. */
    readonly idField: string
    /** The field that names an item. */
    readonly titleField: string
}

/** One operation of the spec, in the small shape a connection keeps (no schemas). */
export interface OpenApiOperation {
    /** The operation id (cleaned). */
    readonly id: string
    /** The HTTP method. */
    readonly method: OpenApiMethod
    /** The path, starting with a slash. */
    readonly path: string
    /** A one-line summary. */
    readonly summary: string
    /** Its parameters. */
    readonly params: ReadonlyArray<OpenApiParam>
    /** Whether it takes a request body. */
    readonly hasBody: boolean
    /** Only present when read from a fresh spec; never stored. */
    readonly suggest?: OpenApiSuggest
}

/** One operation pulled into the hub on every sync. */
export interface OpenApiPull {
    /** The operation pulled. */
    readonly opId: string
    /** The hub entity of its rows. */
    readonly entity: OpenApiPullEntity
    /** Dotted path of the items array; empty finds the first list. */
    readonly itemsPath: string
    /** The item field used as the external id. */
    readonly idField: string
    /** The item field used as the title. */
    readonly titleField: string
    /** Fixed query string for required parameters. */
    readonly fixedQuery: string
}

/** The non-secret configuration of an API connection. */
export interface OpenApiConfig {
    /** The format version. */
    readonly v: 1
    /** Where the spec came from. */
    readonly specUrl: string
    /** The API's base URL. */
    readonly baseUrl: string
    /** The authentication type. */
    readonly authType: OpenApiAuthType
    /** Header or query parameter name of an API key. */
    readonly authName: string
    /** Only the operations pulled or allowed as tools. */
    readonly ops: ReadonlyArray<OpenApiOperation>
    /** The operations pulled on a schedule. */
    readonly pulls: ReadonlyArray<OpenApiPull>
    /** Operation ids agents may call. */
    readonly tools: ReadonlyArray<string>
}

/** The credential of an API connection. */
export interface OpenApiAuth {
    /** The authentication type. */
    readonly type: OpenApiAuthType
    /** Header or query parameter name. */
    readonly name: string
    /** The key or token. */
    readonly value: string
    /** The basic-auth user. */
    readonly user: string
    /** The basic-auth password. */
    readonly password: string
}

/** The authentication a spec hints at. */
export interface OpenApiAuthHint {
    /** The authentication type. */
    readonly type: OpenApiAuthType
    /** The header or query parameter name, when the type has one. */
    readonly name: string
}

/** The id and title fields guessed for an item. */
export interface OpenApiFieldGuess {
    /** The field that identifies an item. */
    readonly idField: string
    /** The field that names an item. */
    readonly titleField: string
}

/** The array of items found in an answer. */
export interface OpenApiItemList {
    /** Whether an array was found at all. */
    readonly found: boolean
    /** The dotted path of the array; empty when the answer is the array. */
    readonly path: string
    /** The items. */
    readonly items: ReadonlyArray<unknown>
}

/** What a spec describes. */
export interface OpenApiSpec {
    /** The API title. */
    readonly title: string
    /** The base URL the spec names. */
    readonly baseUrl: string
    /** Its operations. */
    readonly ops: ReadonlyArray<OpenApiOperation>
    /** The authentication the spec hints at. */
    readonly authHint: OpenApiAuthHint
}

/** One call to an operation. */
export interface OpenApiCall {
    /** The API's base URL. */
    readonly baseUrl: string
    /** The operation. */
    readonly op: OpenApiOperation
    /** The credential. */
    readonly auth: OpenApiAuth
    /** Path/query/header values by parameter name, plus `body`. */
    readonly input: Readonly<Record<string, unknown>>
    /** Fixed query string added to the call. */
    readonly fixedQuery?: string
    /** The largest accepted answer in bytes. */
    readonly maxBytes?: number
    /** A full link to call instead (a "next page" link on the API's own host). */
    readonly link?: string
}

/** What the API answered. */
export interface OpenApiAnswer {
    /** The HTTP status. */
    readonly status: number
    /** Response headers, lower-case names. */
    readonly headers: Readonly<Record<string, string>>
    /** The body as text. */
    readonly text: string
}
