import type { AccountBase, AccountKey, PinnedOperation, PlannedRequest } from "@modules/domain/openapi-tools"

/**
 * The API account a reach is asked about: the connection, its workspace, its provider key and its creation-time sandbox flag (what
 * `portFor` reads), and the connector key its pin serves (`crm.<id>`: the package's word, never read by the engine).
 */
export interface OpenApiReachAccount {
    readonly id: string
    readonly workspaceId: string
    readonly provider: string
    readonly sandbox: boolean
    readonly connector: string
}

/**
 * One call of one operation of the pinned document, as the connector planned it: where (base URL), which operation (its id, method
 * and path template), the placed values (path / query / header parameters by name, plus `body`) and the opened key (null for a
 * sandbox account, which holds none).
 */
export interface OpenApiReachCall {
    readonly baseUrl: string
    readonly operationId: string
    readonly method: PinnedOperation["method"]
    readonly path: string
    readonly params: PlannedRequest["params"]
    readonly hasBody: boolean
    readonly input: Readonly<Record<string, unknown>>
    readonly key: AccountKey | null
    readonly maxBytes: number
}

/** What the outside system answered: the HTTP status and the body text (the connector checks it against the document). */
export interface OpenApiReachAnswer {
    readonly status: number
    readonly text: string
}

/**
 * HOW AN API ACCOUNT IS REACHED (the OpenAPI provider's port, lane concept provider-sandbox): everything of a call that touches the
 * outside system: whether its host may be called, the opened key, the call itself and the look at the live document. The connector
 * keeps every check of its own (the account, the pin, the operation, the arguments, the answer against the document) and asks the port
 * of the ACCOUNT (`OpenApiReachRegistryService.portFor`) for the rest: a live account reaches its real host; a sandbox account is
 * answered from the hardcoded fixtures of the package that pins the document, never a host.
 */
export interface OpenApiReachPort {
    readonly provider: string
    /** Refuses a base URL the account may not call (throws the connector's `host_not_allowed` refusal). */
    reachable(account: OpenApiReachAccount, base: AccountBase): Promise<void>
    /** The opened key of the account, or null when it cannot be opened (the connector refuses `connection_refused`). */
    keyOf(account: OpenApiReachAccount, base: AccountBase): Promise<AccountKey | null>
    /** Sends one planned call and answers the status and body; a failure of the transport throws (the effect is unknown). */
    call(account: OpenApiReachAccount, call: OpenApiReachCall): Promise<OpenApiReachAnswer>
    /** The live document text at the URL, or null when none can be read (the pinned one then stands). */
    liveDocument(account: OpenApiReachAccount, url: string): Promise<string | null>
}
