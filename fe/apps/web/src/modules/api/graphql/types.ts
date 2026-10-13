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

/**
 * A generated input as callers build it: the client preset spells an optional input key as a required `T | null | undefined`
 * key (avoidOptionals), so every key that may be undefined is made optional again, all the way down.
 */
export type WireInput<T> = T extends readonly (infer TItem)[]
    ? WireInput<TItem>[]
    : T extends object
      ? { [K in keyof T as undefined extends T[K] ? K : never]?: WireInput<T[K]> } & {
            [K in keyof T as undefined extends T[K] ? never : K]: WireInput<T[K]>
        }
      : T
