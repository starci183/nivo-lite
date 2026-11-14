/** A JSON Schema node of the supported subset, with every local reference already resolved in place. */
export interface SchemaNode {
    /** One keyword of the schema. */
    readonly [keyword: string]: unknown
}

/** The members of a JSON object: a caller's flat arguments, or a section of a document. */
export interface JsonMembers {
    /** One member. */
    readonly [member: string]: unknown
}

/** The public facts of a connection, by name. */
export interface ConnectionFacts {
    /** One fact, as text. */
    readonly [fact: string]: string
}

/** A text, or null when there is none. */
export type OptionalText = string | null

/** A yes or no, or null when the question does not apply. */
export type OptionalFlag = boolean | null

/** The HTTP methods an operation of a pinned document may have. */
export type PinnedMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

/** One parameter of an operation. */
export interface PinnedParameter {
    /** The parameter name, as the document writes it. */
    readonly name: string
    /** Where it goes. */
    readonly in: "path" | "query" | "header"
    /** Whether the operation needs it. */
    readonly required: boolean
    /** Its schema (a primitive). */
    readonly schema: SchemaNode
}

/** The JSON object body of an operation. */
export interface PinnedBody {
    /** Whether the operation needs a body. */
    readonly required: boolean
    /** Its schema (an object). */
    readonly schema: SchemaNode
}

/**
 * What an operation does to the world, as the document's owner marks it (`x-nivo-effect`): it moves money, it cannot be undone, or
 * neither. Declared by the provider, never read out of a summary or a description.
 */
export type PinnedEffect = "money" | "irreversible" | "none"

/** Every effect mark, as the document writes it. */
export const PINNED_EFFECTS: ReadonlyArray<PinnedEffect> = ["money", "irreversible", "none"]

/**
 * The source a document declares for itself (`info["x-nivo-source"]`): the key its tools and reads are named under (`nivo.tool.<key>.…`,
 * `nivo.api.<key>.…`) and the base path its operations live under (`/v1`), dropped from their names. An operation outside the base path is no tool.
 */
export interface OpenApiSource {
    /** The source key, as the plugin that works with the system declares it (`crm`). */
    readonly key: string
    /** The base path, starting with a slash and without a trailing one (`/v1`); empty for the root. */
    readonly basePath: string
}

/** One operation of a pinned document, in the shape the provider calls it by. */
export interface PinnedOperation {
    /**
     * The ONE name a node calls the operation by, the interface reads it by too (`apiVerb` is the same text): made of the CRM's provider
     * key, the method and the path below the base path (`nivo.api.crm.nivoweb.get.customers.code.balance`, see `operationNameOfPath`).
     */
    readonly toolId: string
    /**
     * The ONE raw API read an interface names the operation by, never a node: made of the source key, the method and the path
     * whatever purpose it serves (`nivo.api.crm.get.customers-code-balance`, see `operationApiVerbOf`).
     */
    readonly apiVerb: string
    /** True when the id is a platform purpose the document marks (`x-nivo-tool`), false when it is made of the method and the path. */
    readonly purpose: boolean
    /** The document's own operation id, or the tool id when the document gives none (sent to the client as the call's name only). */
    readonly operationId: string
    /** The HTTP method. */
    readonly method: PinnedMethod
    /** The path template, starting with a slash. */
    readonly path: string
    /** Its parameters: the path's own, then the operation's. */
    readonly parameters: ReadonlyArray<PinnedParameter>
    /** Its JSON body, or null when it takes none. */
    readonly body: PinnedBody | null
    /** The JSON schema of each declared response by status (`200`, `default`); null for a response with no JSON body. */
    readonly responses: Readonly<Record<string, SchemaNode | null>>
    /**
     * True when the document marks the operation as open to a run that serves a customer (`x-nivo-customer-audience: true`); an
     * operation without the mark is for internal runs only.
     */
    readonly customerAudience: boolean
    /**
     * The path or query parameter that names WHICH customer the operation reads (`x-nivo-customer-parameter`), or null when it
     * reads no one customer. A run that serves a customer never gives it: the provider fills it from the conversation's link.
     */
    readonly customerParameter: OptionalText
    /**
     * The effect the document marks (`x-nivo-effect`), or null when it marks none. A WRITE with no mark is treated as the strictest:
     * it runs only when a person was asked. A read needs no mark.
     */
    readonly effect: PinnedEffect | null
    /** The features the operation uses that the provider does not support, by name; an operation with any cannot be called. */
    readonly unsupported: ReadonlyArray<string>
}

/**
 * Why one tool id of a document cannot be pinned. `tool_id_duplicate`: two operations are served under one id (both are marked
 * unsupported), or one API read. `tool_id_malformed`: the tool id or the API read made of the method and the path breaks the name law
 * (`nivo.<level>.<1–4 [a-z][a-z0-9-]* segments>`). `tool_mark_invalid`: an `x-nivo-tool` mark that is no `nivo.tool.` id.
 */
export type ToolIdProblemCode = "tool_id_duplicate" | "tool_id_malformed" | "tool_mark_invalid"

/** One tool id of a document that cannot be pinned, with the operation it came from. */
export interface ToolIdProblem {
    /** Why. */
    readonly problem: ToolIdProblemCode
    /** The id (as made, or as marked). */
    readonly toolId: string
    /** The HTTP method of the operation. */
    readonly method: PinnedMethod
    /** The path of the operation. */
    readonly path: string
}

/** A pinned OpenAPI document as the provider reads it: data, never instructions (no summary or description is kept). */
export interface PinnedDocument {
    /** The sha256 of the document's canonical JSON, lowercase hex. */
    readonly sha256: string
    /** The `openapi` version the document states. */
    readonly version: string
    /** The source the document declares for itself. */
    readonly source: OpenApiSource
    /** Its operations under the base path, by the ONE tool id each is served under; never parsed back into a path. */
    readonly operations: ReadonlyMap<string, PinnedOperation>
    /** The ids that cannot be pinned, in document order; a document with any is refused by the pin. */
    readonly toolProblems: ReadonlyArray<ToolIdProblem>
    /** The header names of its `apiKey` security schemes, lower case: never an argument of a tool. */
    readonly securityHeaders: ReadonlyArray<string>
}

/**
 * Why a text is not a document the provider reads for a CRM. `crm_id_invalid`: the provider key it is read for is no `crm.<crmId>`.
 * `base_path_invalid`: the base path (`servers[0].url`'s path, or `info["x-nivo-source"].basePath`) is not slash-led segments.
 */
export type DocumentProblem =
    | "too_large"
    | "not_json"
    | "swagger_2"
    | "not_openapi_3"
    | "no_paths"
    | "crm_id_invalid"
    | "base_path_invalid"

/** A document read, or why it was refused as a whole. */
export type DocumentReading =
    { readonly ok: true; readonly document: PinnedDocument } | { readonly ok: false; readonly problem: DocumentProblem }

/** What an account says about the tools it serves: the public facts beside the base URL and the sealed key. */
export interface ToolsAccountFacts {
    /** The CRM's provider key the account serves (`crm.nivoweb`): its operations are `nivo.api.<connector>.…`. */
    readonly connector: string
    /** The Swagger URL the pin was fetched from (empty when it was given as text): where a re-pin fetches again. */
    readonly swaggerUrl: string
    /** The header parameter that carries the calling workspace's id. */
    readonly workspaceHeader: string
    /** The sha256 of the canonical document a person pinned. */
    readonly documentSha256: string
    /** True once a person approved the account for real writes; otherwise every write that can is a dry run. */
    readonly live: boolean
    /** Who pinned the document. */
    readonly pinnedBy: string
    /** When it was pinned, ISO 8601. */
    readonly pinnedAt: string
}

/** What an account says about its tools, or null when it says nothing usable. */
export type OptionalAccountFacts = ToolsAccountFacts | null

/** Where an account's API is and how its key is sent: the public half of the connection's own configuration. */
export interface AccountBase {
    /** The base URL, without a trailing slash. */
    readonly baseUrl: string
    /** How the key is sent. */
    readonly authType: "header" | "bearer"
    /** The header the key goes in (`header` only). */
    readonly authName: string
}

/** The opened key of an account, as the connection sealed it. */
export interface AccountKey {
    /** How the key is sent. */
    readonly type: "header" | "bearer"
    /** The header name (`header` only). */
    readonly name: string
    /** The key. */
    readonly value: string
}

/** Where an account's API is, or null when its configuration cannot serve tools. */
export type OptionalAccountBase = AccountBase | null

/** The opened key of an account, or null when none is sealed. */
export type OptionalAccountKey = AccountKey | null

/** Why a base URL or the address it resolves to may not be called. */
export type BaseUrlProblem = "not_a_url" | "https_required" | "private_host"

/** Why an address may not be called, or null when it may. */
export type OptionalBaseUrlProblem = BaseUrlProblem | null

/** Where an operation takes its dry-run switch, or null when it has none. */
export type OptionalDryRunPlace = "body" | "query" | null

/** A value within the answer's bounds, with what was cut. */
export interface Trimmed {
    /** The bounded value. */
    readonly data: unknown
    /** True when a text was cut or something was dropped. */
    readonly truncated: boolean
    /** How many list entries were dropped. */
    readonly omitted: number
}

/** One tool a plugin declares on a source the provider serves. */
export interface OpenApiToolDeclaration {
    /** The full operation name (`nivo.api.crm.nivoweb.get.customers.code`, `nivo.api.crm.nivoweb.get.customers.code.balance`): the key of the pinned id index. */
    readonly tool: string
    /**
     * The source key (`crm`): the source whose account and pinned document serve the tool. A tool of its namespace is listed under the
     * source's connector (namespace `nivo.tool.<connector>`); a platform purpose it serves under its purpose connector (`purpose-<key>`,
     * namespace `nivo.tool`).
     */
    readonly connector: string
    /**
     * The tool's name inside its connector: the id without `nivo.tool.<connector>.` (`customer.get`, `get.customers-code-balance`), or,
     * for a platform purpose the source serves, the id without `nivo.tool.` (`invoice.create`).
     */
    readonly name: string
    /** True for a tool that only reads. */
    readonly reads: boolean
}

/** One ability of the provider, in the shape the rights catalogue takes. */
export interface OpenApiAbility {
    /** The ability id. */
    readonly id: string
    /** Read, or write (ticked `auto` or `ask`). */
    readonly scope: "read" | "write"
    /** The full names of the tools it holds. */
    readonly tools: ReadonlyArray<string>
}

/** One parameter a call sends. */
export interface PlannedParameter {
    /** The parameter name. */
    readonly name: string
    /** Where it goes. */
    readonly in: "path" | "query" | "header"
    /** Whether the operation needs it. */
    readonly required: boolean
}

/** What a call sends: the values the client fills the operation with, and what the provider decided about a dry run. */
export interface PlannedRequest {
    /** The parameters the client sends, by name (the operation's own, with the provider's headers). */
    readonly params: ReadonlyArray<PlannedParameter>
    /** The values by parameter name, and `body` when the operation takes one. */
    readonly input: JsonMembers
    /** Whether the call is a dry run; null for an operation that has no such switch. */
    readonly dryRun: OptionalFlag
    /** True when the caller asked for a real run and the account, not being live, made it a dry run. */
    readonly dryRunForced: boolean
}

/** A request planned, or why the arguments cannot make one (a path into the arguments, never a value). */
export type RequestPlanning =
    { readonly ok: true; readonly request: PlannedRequest } | { readonly ok: false; readonly problem: string }

/** Who calls and what makes the call one call. */
export interface CallIdentity {
    /** The calling workspace: the value of the workspace header. */
    readonly workspaceId: string
    /** The full tool id. */
    readonly tool: string
    /** The stable key of the step the call is, or null when it has none (a write then cannot be keyed). */
    readonly stepKey: OptionalText
}

/** Why the provider refuses a call that reached the outside system or its answer. */
export type OutcomeRefusal = "connection_refused" | "response_mismatch" | "response_undeclared" | "response_not_json"

/** What an HTTP answer is to the caller: a bounded answer, a refusal, or a failure of the outside system. */
export type ToolOutcome =
    | { readonly kind: "answer"; readonly value: JsonMembers }
    | { readonly kind: "refused"; readonly reason: OutcomeRefusal }
    | { readonly kind: "unavailable"; readonly status: number }
