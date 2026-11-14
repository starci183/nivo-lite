/*
 * THE FIXTURES A PACKAGE SHIPS for the sandbox of an outside system it pins by OpenAPI document (owner ruling R75: the engine knows no
 * system noun: operations, collections and fields are the package's words, data the engine stores and reads back without meaning).
 * Keyed by the document's operation ids; the engine's OpenAPI sandbox answers each call of a sandbox account from them.
 */

/** A write whose answer the system would remember: kept under the package's collection, keyed by the value at `keyField` of the answer. */
export interface OpenApiSandboxKeeps {
    /** The collection the record is kept in (the package's word). */
    readonly collection: string
    /** The answer's field naming the record (a top-level field); a running `sbx-<n>` is placed there when the answer has none. */
    readonly keyField: string
}

/** A read that answers a record an earlier write kept: from `collection`, keyed by the call's parameter `keyParam` (path or query). */
export interface OpenApiSandboxReadsBack {
    readonly collection: string
    readonly keyParam: string
}

/**
 * How one operation answers on a sandbox account: the HTTP status and the JSON body of its success, stateful only where a call must
 * change later reads: a write that `keeps` its answer (the request body laid over the fixture's body, keyed as declared), a read that
 * `readsBack` a kept record (a record nobody kept answers the fixture's body; a list read with `listsBack` answers the fixture's body
 * with the collection's kept records appended under `listField`).
 */
export interface OpenApiSandboxOperationFixture {
    readonly status: number
    readonly body: unknown
    readonly keeps?: OpenApiSandboxKeeps | undefined
    readonly readsBack?: OpenApiSandboxReadsBack | undefined
    readonly listsBack?: { readonly collection: string; readonly listField: string } | undefined
}

/** The fixtures of one connector (`crm.<id>`), by the pinned document's operation id. */
export interface OpenApiSandboxFixtures {
    readonly connector: string
    readonly operations: Readonly<Record<string, OpenApiSandboxOperationFixture>>
}
