import type { Response } from "express"
import type { OperationRequest } from "@modules/platform/http-security"

/** The GraphQL context every operation runs with: the HTTP request it arrived on and its response. */
export interface GraphqlContext {
    /** The HTTP request. */
    readonly req: OperationRequest
    /** The HTTP response. */
    readonly res: Response
}

/** The deepest selection nesting an operation may have. */
export const GRAPHQL_DEPTH_MAX = 10
