/**
 * The client-side outcome of one call, in the shape the toast helpers read (`success`, `message`, optional `error`, nested
 * `data`): a GraphQL operation (built by `toGraphQLResponse`, never part of the wire contract; the back end reports a failure
 * as `errors[]`) and a browser Auth call (modules/auth) answer with it alike. Never a throw for an expected failure.
 */
export interface GraphQLResponse<TData = undefined> {
    readonly success: boolean
    readonly message: string
    readonly error?: string | undefined
    readonly data?: TData
}
