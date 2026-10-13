/**
 * The client-side outcome of one GraphQL operation, in the shape the toast helpers read (`success`, `message`, optional
 * `error`, nested `data`). The back end answers the typed payload itself and reports a failure as `errors[]`; this wrapper is
 * built on the client by `toGraphQLResponse` and is never part of the wire contract.
 */
export interface GraphQLResponse<TData = undefined> {
    success: boolean
    message: string
    error?: string
    data?: TData
}

/** Header names the clients send. */
export enum GraphQLHeadersKey {
    /** The workspace the operation runs in. */
    XWorkspaceId = "X-Workspace-Id",
    /** The locale the failure copy is localized in. */
    AcceptLanguage = "Accept-Language",
}

/** The static headers an operation may carry. */
export type GraphQLHeaders = Partial<Record<GraphQLHeadersKey, string>> & Record<string, string | undefined>

/** Per-operation options: the optional `signal` aborts the underlying `fetch` (an SWR cleanup, a route change). */
export interface GraphQLOperationContext {
    /** Optional abort signal. */
    signal?: AbortSignal
}

/** Parameters every query file takes. */
export interface QueryParams<TQuery, TRequest = undefined> extends GraphQLOperationContext {
    /** Which stored document to run. */
    query?: TQuery
    /** The variables of the query. */
    request?: TRequest
    /** Extra headers. */
    headers?: GraphQLHeaders
}

/** Parameters every mutation file takes. */
export interface MutateParams<TMutation, TRequest> extends GraphQLOperationContext {
    /** Which stored document to run. */
    mutation?: TMutation
    /** The input of the mutation. */
    request: TRequest
    /** Extra headers. */
    headers?: GraphQLHeaders
}

/** The variables bag of an operation whose single argument is `input`. */
export interface InputVariables<TInput> {
    input: TInput
}
